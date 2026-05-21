// ── Crowdsourced Live Occupancy Tracking ─────────────────────────────────────

// 1. Handle Active Student Check-In


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
