import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import connectDB from './db.js';

const app = express();

app.use(cors());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Welcome Route ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>XeroxPro Backend</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f4f8; margin: 0; }
        .container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        h1 { color: #2b6cb0; margin-bottom: 0.5rem; }
        p { color: #4a5568; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🖨️ XeroxPro Backend API</h1>
        <p>The server is running successfully in the cloud.</p>
      </div>
    </body>
    </html>
  `);
});

// ─── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ─── Multer Setup (memory storage — files kept in RAM then saved to MongoDB) ───
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/jpg',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'), false);
    }
  },
});

// ─── Mongoose Schemas & Models ─────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  phone: { type: String, default: null },
  department: { type: String, default: 'ECE' },
  role: { type: String, enum: ['staff', 'admin'], default: 'staff' },
  created_at: { type: Date, default: Date.now },
});

const printJobSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  user_name: { type: String, required: true },
  print_type: { type: String, required: true },
  orientation: { type: String, default: 'vertical' },
  color: { type: String, default: 'bw' },
  copies: { type: Number, default: 1 },
  pages: { type: Number, default: 1 },
  file_name: { type: String, default: null },
  file_data: { type: Buffer, default: null },
  file_mimetype: { type: String, default: null },
  file_size: { type: Number, default: null },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Rejected'], default: 'Pending' },
  created_at: { type: Date, default: Date.now },
});

const paperRequestSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  user_name: { type: String, required: true },
  paper_type: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  created_at: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const PrintJob = mongoose.model('PrintJob', printJobSchema);
const PaperRequest = mongoose.model('PaperRequest', paperRequestSchema);

// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      res.json({ ok: true, db: 'MongoDB' });
    } else {
      res.status(500).json({ ok: false, error: 'Database not connected' });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

// ─── User Routes ───────────────────────────────────────────────────────────────

app.post('/api/users/register', async (req, res) => {
  try {
    const { email, username, password, phone, id } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { id }] });
    if (existing) {
      return res.status(400).json({ error: 'Email or Staff ID already registered' });
    }

    await User.create({ id, email, username, password, phone });
    res.json({ message: 'User registered successfully', userId: id });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { id, password, role } = req.body;

    if (role === 'staff') {
      const user = await User.findOne({ id, password });
      if (user) {
        return res.json({ success: true, user, role: 'staff' });
      }
    } else if (role === 'admin') {
      // Hardcoded fallback admin
      if (id === 'admin' && password === 'admin123') {
        return res.json({
          success: true,
          user: { id: 'admin', username: 'Admin', email: 'admin@xerox.com', department: 'Admin', role: 'admin' },
          role: 'admin',
        });
      }

      const admin = await User.findOne({ id, password, role: 'admin' });
      if (admin) {
        return res.json({ success: true, user: admin, role: 'admin' });
      }
    }

    res.status(401).json({ error: 'Invalid ID or Password' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    await User.findOneAndUpdate({ id: req.params.id }, { password });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, email, phone, department } = req.body;
    await User.findOneAndUpdate({ id: req.params.id }, { username, email, phone, department });
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Print Job Routes (with JSON file upload) ──────────────────────────────────

// Submit a print job WITH file upload (Base64 JSON to bypass Vercel multer issues)
app.post('/api/print-jobs', async (req, res) => {
  try {
    const { userName, userId, printType, orientation, color, copies, pages, fileName, fileData, fileType, fileSize } = req.body;

    const jobData = {
      user_name: userName,
      user_id: userId,
      print_type: printType,
      orientation,
      color,
      copies: Number(copies),
      pages: Number(pages),
      file_name: fileName,
    };

    // If Base64 string was sent, parse it into Mongoose Buffer
    if (fileData) {
      // The frontend sends standard DATA URL: data:image/png;base64,iVBORw0K...
      const base64String = fileData.split(',')[1];
      if (base64String) {
        jobData.file_data = Buffer.from(base64String, 'base64');
        jobData.file_mimetype = fileType;
        jobData.file_size = fileSize;
      }
    }

    const job = await PrintJob.create(jobData);

    res.json({ message: 'Print job submitted successfully', jobId: job._id });
  } catch (error) {
    console.error('Error creating print job:', error);
    res.status(500).json({ error: 'Failed to create print job' });
  }
});

// Get all print jobs (exclude file_data for performance)
app.get('/api/print-jobs', async (req, res) => {
  try {
    const jobs = await PrintJob.find()
      .select('-file_data')
      .sort({ date: -1, created_at: -1 });
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching print jobs:', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

// Get print jobs for a specific user (exclude file_data)
app.get('/api/print-jobs/user/:userId', async (req, res) => {
  try {
    const jobs = await PrintJob.find({ user_id: req.params.userId })
      .select('-file_data')
      .sort({ date: -1, created_at: -1 });
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching print jobs:', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

// Update print job status
app.put('/api/print-jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await PrintJob.findByIdAndUpdate(req.params.id, { status });
    res.json({ message: 'Print job status updated successfully' });
  } catch (error) {
    console.error('Error updating print job status:', error);
    res.status(500).json({ error: 'Failed to update print job status' });
  }
});

// Download / view the uploaded file for a print job
app.get('/api/print-jobs/:id/file', async (req, res) => {
  try {
    const job = await PrintJob.findById(req.params.id).select('file_data file_mimetype file_name');

    if (!job || !job.file_data) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.set({
      'Content-Type': job.file_mimetype || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${job.file_name || 'document'}"`,
      'Content-Length': job.file_data.length,
    });

    res.send(job.file_data);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// ─── Print to Real Printer ─────────────────────────────────────────────────────

// Print a job to the connected printer
app.post('/api/print-jobs/:id/print', async (req, res) => {
  try {
    const job = await PrintJob.findById(req.params.id);

    if (!job || !job.file_data) {
      return res.status(404).json({ error: 'Print job or file not found' });
    }

    // Only allow printing PDF files directly
    if (job.file_mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files can be sent to the printer. Please convert your document to PDF first.' });
    }

    // Dynamically import pdf-to-printer (ESM — uses default export)
    const pdfPrinter = await import('pdf-to-printer');
    const print = pdfPrinter.default?.print || pdfPrinter.print;

    // Save the file to a temp location
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `xerox_print_${job._id}_${Date.now()}.pdf`);
    fs.writeFileSync(tempFile, job.file_data);

    // Build print options
    const printOptions = {
      copies: job.copies || 1,
    };

    // Set orientation
    if (job.orientation === 'horizontal') {
      printOptions.orientation = 'landscape';
    } else {
      printOptions.orientation = 'portrait';
    }

    // Set duplex (front-and-back)
    if (job.print_type === 'front-and-back') {
      printOptions.side = 'duplex';
    }

    // Set color mode
    if (job.color === 'bw') {
      printOptions.monochrome = true;
    }

    // If a specific printer is requested
    if (req.body.printer) {
      printOptions.printer = req.body.printer;
    }

    console.log(`🖨  Printing job ${job._id} — ${job.file_name} (${job.copies} copies, ${job.orientation}, ${job.color})`);

    // Send to printer
    await print(tempFile, printOptions);

    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (cleanupErr) {
      console.warn('Warning: Could not clean up temp file:', cleanupErr.message);
    }

    // Update job status to Completed
    await PrintJob.findByIdAndUpdate(req.params.id, { status: 'Completed' });

    res.json({ message: 'Document sent to printer successfully', status: 'Completed' });
  } catch (error) {
    console.error('Error printing document:', error);
    res.status(500).json({ error: 'Failed to print document: ' + error.message });
  }
});

// Print all pending jobs to the connected printer
app.post('/api/print-jobs/print-pending', async (req, res) => {
  try {
    const jobs = await PrintJob.find({ status: 'Pending' });
    
    if (jobs.length === 0) {
      return res.json({ message: 'No pending jobs found', printedCount: 0 });
    }

    const pdfPrinter = await import('pdf-to-printer');
    const print = pdfPrinter.default?.print || pdfPrinter.print;
    const tempDir = os.tmpdir();
    let printedCount = 0;

    for (const job of jobs) {
      if (!job.file_data || job.file_mimetype !== 'application/pdf') {
        continue; // skip non-pdf or jobs without files
      }

      const tempFile = path.join(tempDir, `xerox_print_${job._id}_${Date.now()}.pdf`);
      fs.writeFileSync(tempFile, job.file_data);

      const printOptions = { copies: job.copies || 1 };
      if (job.orientation === 'horizontal') printOptions.orientation = 'landscape';
      else printOptions.orientation = 'portrait';
      if (job.print_type === 'front-and-back') printOptions.side = 'duplex';
      if (job.color === 'bw') printOptions.monochrome = true;
      if (req.body.printer) printOptions.printer = req.body.printer;

      console.log(`🖨  Printing pending job ${job._id} — ${job.file_name}`);

      try {
        await print(tempFile, printOptions);
        await PrintJob.findByIdAndUpdate(job._id, { status: 'Completed' });
        printedCount++;
      } catch (err) {
        console.error(`Failed to print job ${job._id}:`, err);
      }

      try { fs.unlinkSync(tempFile); } catch (e) {}
    }

    res.json({ message: `Successfully sent ${printedCount} pending jobs to printer`, printedCount });
  } catch (error) {
    console.error('Error printing pending documents:', error);
    res.status(500).json({ error: 'Failed to print pending documents' });
  }
});

// Get available printers
app.get('/api/printer/list', async (req, res) => {
  try {
    const pdfPrinter = await import('pdf-to-printer');
    const getPrinters = pdfPrinter.default?.getPrinters || pdfPrinter.getPrinters;
    const printers = await getPrinters();
    res.json({ printers });
  } catch (error) {
    console.error('Error getting printers:', error);
    res.status(500).json({ error: 'Failed to get printer list', printers: [] });
  }
});

// Check printer status
app.get('/api/printer/status', async (req, res) => {
  try {
    const pdfPrinter = await import('pdf-to-printer');
    const getPrinters = pdfPrinter.default?.getPrinters || pdfPrinter.getPrinters;
    const printers = await getPrinters();

    if (printers.length > 0) {
      res.json({
        online: true,
        defaultPrinter: printers[0]?.name || 'Unknown',
        totalPrinters: printers.length,
        printers,
      });
    } else {
      res.json({ online: false, defaultPrinter: null, totalPrinters: 0, printers: [] });
    }
  } catch (error) {
    console.error('Error checking printer status:', error);
    res.json({ online: false, defaultPrinter: null, totalPrinters: 0, error: error.message });
  }
});

// ─── Paper Request Routes ──────────────────────────────────────────────────────

app.post('/api/paper-requests', async (req, res) => {
  try {
    const { userName, userId, paperType, quantity } = req.body;

    const request = await PaperRequest.create({
      user_name: userName,
      user_id: userId,
      paper_type: paperType,
      quantity,
    });

    res.json({ message: 'Paper request submitted successfully', requestId: request._id });
  } catch (error) {
    console.error('Error creating paper request:', error);
    res.status(500).json({ error: 'Failed to create paper request' });
  }
});

app.get('/api/paper-requests', async (req, res) => {
  try {
    const requests = await PaperRequest.find().sort({ date: -1, created_at: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching paper requests:', error);
    res.status(500).json({ error: 'Failed to fetch paper requests' });
  }
});

app.get('/api/paper-requests/user/:userId', async (req, res) => {
  try {
    const requests = await PaperRequest.find({ user_id: req.params.userId }).sort({ date: -1, created_at: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching paper requests:', error);
    res.status(500).json({ error: 'Failed to fetch paper requests' });
  }
});

app.put('/api/paper-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await PaperRequest.findByIdAndUpdate(req.params.id, { status });
    res.json({ message: 'Paper request status updated successfully' });
  } catch (error) {
    console.error('Error updating paper request status:', error);
    res.status(500).json({ error: 'Failed to update paper request status' });
  }
});

// ─── Multer Error Handler ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

export default app;
