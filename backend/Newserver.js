// ── STUDENT AUTHENTICATION ENDPOINTS ────────────────────────────────────────

// Login / Auto-Registration Prototype Handler Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Restrict access strictly to valid institutional Hunter College email extensions
    if (!normalizedEmail.endsWith('@myhunter.cuny.edu') && !normalizedEmail.endsWith('@hunter.cuny.edu')) {
      return res.status(400).json({ error: 'Access restricted to valid Hunter College student emails.' });
    }

    // Connect to database collection context
    const result = await db.collection('students').findOneAndUpdate(
      { email: normalizedEmail },
      {
        $setOnInsert: {
          email: normalizedEmail,
          password: password,
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    const student = result.value || result;

    const isNewRegistration = student.createdAt && (new Date() - student.createdAt < 1000);

    if (isNewRegistration) {
      return res.status(200).json({
        message: 'Student account registered successfully!',
        email: normalizedEmail
      });
    }
    

    // Validate password match
    if (student.password !== password) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    return res.status(200).json({ 
      message: 'Login successful.', 
      email: student.email 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
