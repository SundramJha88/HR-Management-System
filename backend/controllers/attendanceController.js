const Attendance = require('../models/Attendance')
const mongoose = require('mongoose')

const pad = n => (n < 10 ? '0' + n : String(n))
const secondsToHMS = secs => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

const computeStatus = totalHours => {
  if (totalHours === 0) return 'pending'
  if (totalHours < 5) return 'early'
  if (totalHours >= 5 && totalHours < 8) return 'halfday'
  if (totalHours >= 8 && totalHours < 9) return 'present'
  if (totalHours >= 9 && totalHours < 24) return 'overtime'
  return 'present'
}

exports.punchIn = async (req, res) => {
  try {
    const userId = req.user.id
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    let att
    try {
      att = new Attendance({
        userId: mongoose.Types.ObjectId(userId),
        date,
        punchIn: hhmm,
        punchInIso: now,
        status: 'pending'
      })
      await att.save()
    } catch (err) {
      if (err.code === 11000) {
        att = await Attendance.findOne({ userId, date })
        if (!att) return res.status(500).json({ msg: 'Unable to find attendance record' })
        if (att.punchInIso && !att.punchOutIso) {
          return res.status(400).json({ msg: 'Already punched in for today' })
        }
        if (att.punchOutIso) {
          return res.status(400).json({ msg: 'Today attendance already completed' })
        }
        att.punchIn = hhmm
        att.punchInIso = now
        att.punchOut = null
        att.punchOutIso = null
        att.totalSeconds = 0
        att.totalHoursStr = '00:00:00'
        att.status = 'pending'
        await att.save()
      } else {
        throw err
      }
    }

    return res.json({ msg: 'Punched in', attendance: att })
  } catch (err) {
    console.error('punchIn err', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

exports.punchOut = async (req, res) => {
  try {
    const userId = req.user.id
    const { forceHalfDay } = req.body
    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    let att = await Attendance.findOne({ userId, date })
    if (!att) {
      att = new Attendance({
        userId: mongoose.Types.ObjectId(userId),
        date,
        punchIn: null,
        punchInIso: null,
        punchOut: hhmm,
        punchOutIso: now,
        totalSeconds: 0,
        totalHoursStr: '00:00:00',
        status: 'missedout'
      })
      await att.save()
      return res.status(200).json({ msg: 'Punch-out recorded (no earlier punch-in found)', attendance: att })
    }

    if (att.punchOutIso) {
      return res.status(400).json({ msg: 'Already punched out for today' })
    }

    let totalSeconds = 0
    if (att.punchInIso) {
      const start = new Date(att.punchInIso)
      totalSeconds = Math.max(0, Math.floor((now - start) / 1000))
    } else {
      totalSeconds = 0
    }

    att.punchOut = hhmm
    att.punchOutIso = now
    att.totalSeconds = totalSeconds
    att.totalHoursStr = secondsToHMS(totalSeconds)

    const totalHours = totalSeconds / 3600
    if (forceHalfDay) {
      att.status = 'halfday'
    } else {
      att.status = computeStatus(totalHours)
      if (att.status === 'present' && totalHours >= 8 && totalHours < 9) {
        att.status = 'present'
      }
    }

    await att.save()

    return res.json({ msg: 'Punched out', attendance: att })
  } catch (err) {
    console.error('punchOut err', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id
    const days = parseInt(req.query.days, 10) || 30
    const from = new Date()
    from.setDate(from.getDate() - days)
    const fromStr = from.toISOString().slice(0, 10)

    const list = await Attendance.find({
      userId,
      date: { $gte: fromStr }
    }).sort({ date: -1 })

    return res.json({ data: list })
  } catch (err) {
    console.error('getHistory err', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

exports.getMonth = async (req, res) => {
  try {
    const userId = req.user.id
    const yyyyMM = req.params.yyyyMM
    if (!/^\d{4}-\d{2}$/.test(yyyyMM)) return res.status(400).json({ msg: 'Invalid month format, use YYYY-MM' })

    const prefix = yyyyMM + '-'
    const list = await Attendance.find({
      userId,
      date: { $regex: `^${prefix}` }
    }).sort({ date: 1 })

    return res.json({ data: list })
  } catch (err) {
    console.error('getMonth err', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}

exports.markAbsent = async (req, res) => {
  try {
    const { dateList, userId } = req.body
    if (!Array.isArray(dateList) || dateList.length === 0) return res.status(400).json({ msg: 'dateList required' })

    const uid = userId || req.user.id
    const bulkOps = []

    for (const d of dateList) {
      bulkOps.push({
        updateOne: {
          filter: { userId: mongoose.Types.ObjectId(uid), date: d },
          update: { $setOnInsert: { userId: mongoose.Types.ObjectId(uid), date: d, status: 'absent', totalSeconds: 0, totalHoursStr: '00:00:00' } },
          upsert: true
        }
      })
    }

    if (bulkOps.length) {
      await Attendance.bulkWrite(bulkOps)
    }

    return res.json({ msg: 'Absents marked' })
  } catch (err) {
    console.error('markAbsent err', err)
    return res.status(500).json({ msg: 'Server error' })
  }
}
