// ── Crowdsourced Live Occupancy Tracking ─────────────────────────────────────

// 1. Handle Active Student Check-In
app.post('/api/rooms/:roomId/checkin', async function (req, res) {
  try {
    var roomId = req.params.roomId;
    var emplid = req.body.emplid;
    var studentName = req.body.studentName;
    var subject = req.body.subject;

    if (emplid == null || subject == null || emplid == "" || subject == "") {
      res.status(400).json({ error: 'Missing student credentials or subject target.' });
    } else {
      var checkInCollection = db.collection('room_occupancy');

      var finalName;
      if (studentName == "" || studentName == null) {
        finalName = 'Anonymous Student';
      } else {
        finalName = studentName;
      }

      var searchFilter = { emplid: emplid };
      var updateFields = {
        $set: {
          roomId: roomId,
          studentName: finalName,
          subject: subject,
          timestamp: new Date()
        }
      };
      var settings = { upsert: true };

      // Upsert check-in: updates if student is already checked in somewhere, or adds new
      await checkInCollection.updateOne(searchFilter, updateFields, settings);

      res.json({ success: true, message: 'Successfully checked into space!' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process student check-in.' });
  }
});

// 2. Fetch Live Room Occupancy Data & Subjects Summary
app.get('/api/rooms/:roomId/occupancy', async (req, res) => {
  try {
    const { roomId } = req.params;
    const checkInCollection = db.collection('room_occupancy');

    // Auto-expiry threshold: Ignore check-ins older than 2 hours
    const dynamicThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Pull active students in this specific room
    const activeCheckIns = await checkInCollection.find({
      roomId: roomId,
      timestamp: { $gte: dynamicThreshold }
    }).toArray();

    // Aggregate subjects to see what people are studying
    const subjectBreakdown = {};
    activeCheckIns.forEach(user => {
      const sub = user.subject.trim().toUpperCase();
      subjectBreakdown[sub] = (subjectBreakdown[sub] || 0) + 1;
    });

    res.json({
      roomId: roomId,
      totalStudents: activeCheckIns.length,
      subjectsStudied: subjectBreakdown // Returns format: { "CSCI": 4, "MATH": 2 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate live room occupancy profiles.' });
  }
});
