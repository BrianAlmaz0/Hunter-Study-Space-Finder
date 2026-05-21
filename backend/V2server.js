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
app.get('/api/rooms/:roomId/occupancy', async function (req, res) {
  try {
    var roomId = req.params.roomId;
    var checkInCollection = db.collection('room_occupancy');

    // Auto-expiry threshold: Ignore check-ins older than 2 hours
    var currentMillseconds = Date.now();
    var twoHoursInMilliseconds = 2 * 60 * 60 * 1000;
    var cutoffTimeValue = currentMillseconds - twoHoursInMilliseconds;
    var dynamicThreshold = new Date(cutoffTimeValue);

    var dbQuery = {
      roomId: roomId,
      timestamp: { $gte: dynamicThreshold }
    };

    // Pull active students in this specific room
    var activeCheckIns = await dbCheckInCollection.find(dbQuery).toArray();

    // Aggregate subjects to see what people are studying
    var subjectBreakdown = {};
    
    // Using an old-school for loop instead of forEach or map
    for (var i = 0; i < activeCheckIns.length; i = i + 1) {
      var currentUser = activeCheckIns[i];
      var rawSubject = currentUser.subject;
      var cleanSubject = rawSubject.trim().toUpperCase();
      
      if (subjectBreakdown[cleanSubject] == undefined) {
        subjectBreakdown[cleanSubject] = 1;
      } else {
        subjectBreakdown[cleanSubject] = subjectBreakdown[cleanSubject] + 1;
      }
    }

    var totalStudentsCount = activeCheckIns.length;

    res.json({
      roomId: roomId,
      totalStudents: totalStudentsCount,
      subjectsStudied: subjectBreakdown // Returns format: { "CSCI": 4, "MATH": 2 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate live room occupancy profiles.' });
  }
});
