
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { email, username, password, phone, id } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR id = ?',
      [email, id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email or Staff ID already registered' });
    }

    await pool.execute(
      'INSERT INTO users (id, email, username, password, phone) VALUES (?, ?, ?, ?, ?)',
      [id, email, username, password, phone]
    );

    res.json({ message: 'User registered successfully', userId: id });
  } catch (error) {
    console.error('Error registering user: - app.js:41', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { id, password, role } = req.body;

    if (role === 'staff') {
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE id = ? AND password = ?',
        [id, password]
      );

      if (users.length > 0) {
        return res.json({
          success: true,
          user: users[0],
          role: 'staff',
        });
      }
    } else if (role === 'admin') {
      if (id === 'admin' && password === 'admin123') {
        return res.json({
          success: true,
          user: {
            id: 'admin',
            username: 'Admin',
            email: 'admin@xerox.com',
            department: 'Admin',
            role: 'admin',
          },
          role: 'admin',
        });
      }

      const [admins] = await pool.execute(
        'SELECT * FROM users WHERE id = ? AND password = ? AND role = "admin"',
        [id, password]
      );

      if (admins.length > 0) {
        return res.json({
          success: true,
          user: admins[0],
          role: 'admin',
        });
      }
    }

    res.status(401).json({ error: 'Invalid ID or Password' });
  } catch (error) {
    console.error('Error logging in: - app.js:94', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users: - app.js:104', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Error fetching user: - app.js:119', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;

    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [password, req.params.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password: - app.js:132', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, email, phone, department } = req.body;

    await pool.execute(
      'UPDATE users SET username = ?, email = ?, phone = ?, department = ? WHERE id = ?',
      [username, email, phone, department, req.params.id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile: - app.js:148', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/print-jobs', async (req, res) => {
  try {
    const { userName, userId, printType, orientation, color, copies, pages, fileName } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO print_jobs (user_name, user_id, print_type, orientation, color, copies, pages, file_name, date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'Pending')`,
      [userName, userId, printType, orientation, color, copies, pages, fileName]
    );

    res.json({ message: 'Print job submitted successfully', jobId: result.insertId });
  } catch (error) {
    console.error('Error creating print job: - app.js:165', error);
    res.status(500).json({ error: 'Failed to create print job' });
  }
});

app.get('/api/print-jobs', async (req, res) => {
  try {
    const [jobs] = await pool.execute('SELECT * FROM print_jobs ORDER BY date DESC, created_at DESC');
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching print jobs: - app.js:175', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

app.get('/api/print-jobs/user/:userId', async (req, res) => {
  try {
    const [jobs] = await pool.execute(
      'SELECT * FROM print_jobs WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      [req.params.userId]
    );
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching print jobs: - app.js:188', error);
    res.status(500).json({ error: 'Failed to fetch print jobs' });
  }
});

app.put('/api/print-jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    await pool.execute('UPDATE print_jobs SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({ message: 'Print job status updated successfully' });
  } catch (error) {
    console.error('Error updating print job status: - app.js:201', error);
    res.status(500).json({ error: 'Failed to update print job status' });
  }
});

app.post('/api/paper-requests', async (req, res) => {
  try {
    const { userName, userId, paperType, quantity } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO paper_requests (user_name, user_id, paper_type, quantity, date, status)
       VALUES (?, ?, ?, ?, CURDATE(), 'Pending')`,
      [userName, userId, paperType, quantity]
    );

    res.json({ message: 'Paper request submitted successfully', requestId: result.insertId });
  } catch (error) {
    console.error('Error creating paper request: - app.js:218', error);
    res.status(500).json({ error: 'Failed to create paper request' });
  }
});

app.get('/api/paper-requests', async (req, res) => {
  try {
    const [requests] = await pool.execute(
      'SELECT * FROM paper_requests ORDER BY date DESC, created_at DESC'
    );
    res.json(requests);
  } catch (error) {
    console.error('Error fetching paper requests: - app.js:230', error);
    res.status(500).json({ error: 'Failed to fetch paper requests' });
  }
});

app.get('/api/paper-requests/user/:userId', async (req, res) => {
  try {
    const [requests] = await pool.execute(
      'SELECT * FROM paper_requests WHERE user_id = ? ORDER BY date DESC, created_at DESC',
      [req.params.userId]
    );
    res.json(requests);
  } catch (error) {
    console.error('Error fetching paper requests: - app.js:243', error);
    res.status(500).json({ error: 'Failed to fetch paper requests' });
  }
});

app.put('/api/paper-requests/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    await pool.execute('UPDATE paper_requests SET status = ? WHERE id = ?', [status, req.params.id]);

    res.json({ message: 'Paper request status updated successfully' });
  } catch (error) {
    console.error('Error updating paper request status: - app.js:256', error);
    res.status(500).json({ error: 'Failed to update paper request status' });
  }
});

export default app;
