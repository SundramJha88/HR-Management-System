(() => {
  const API_BASE = "http://localhost:5000";
  const tokenKey = "token";
  const userIdKey = "userId";
  const userNameKey = "userName";

  const apiFetch = async (path, opts = {}) => {
    const headers = opts.headers || {};
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    const token = localStorage.getItem(tokenKey);
    if (token) headers["auth-token"] = token;
    const cfg = Object.assign({}, opts, { headers });
    try {
      const res = await fetch(API_BASE + path, cfg);
      const txt = await res.text();
      try { return JSON.parse(txt); } catch(e) { return { raw: txt, status: res.status }; }
    } catch (e) {
      return null;
    }
  };

  const syncFromServer = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    const att = await apiFetch("/attendance/history", { method: "GET" });
    if (att && Array.isArray(att)) {
      att.forEach(a => {
        try {
          const dateKey = a.date;
          if (a.punchIn) localStorage.setItem(`punchIn_${dateKey}`, a.punchIn);
          if (a.punchOut) localStorage.setItem(`punchOut_${dateKey}`, a.punchOut);
          if (a.totalHours) localStorage.setItem(`workHours_${dateKey}`, a.totalHours);
          if (a.status === "halfday") localStorage.setItem(`halfDay_${dateKey}`, "true");
          if (a.status === "present" || a.status === "fullday" || a.status === "fullDay") localStorage.setItem(`fullDay_${dateKey}`, "true");
          if (a.status === "leave") localStorage.setItem(`leave_${dateKey}`, "true");
        } catch (e) {}
      });
    }
    const leaves = await apiFetch("/leave", { method: "GET" });
    if (leaves && Array.isArray(leaves)) {
      leaves.forEach(l => {
        try {
          localStorage.setItem(`leave_${l.date}`, "true");
          if (l.reason) localStorage.setItem(`leaveReason_${l.date}`, l.reason);
        } catch (e) {}
      });
    }
  };

  window.syncFromServer = syncFromServer;
})();

(() => {
  const page = location.pathname.split('/').pop().toLowerCase();
  if (page === 'login.html') return;
  const token = localStorage.getItem('token');
  const emp = localStorage.getItem('loggedInEmp');
  if (!token || !emp) {
    localStorage.clear();
    location.href = 'login.html';
    return;
  }
  fetch('http://localhost:5000/auth/me', { method: 'GET', headers: { 'auth-token': token } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => {
      const ok = !!(d && (d.id || d._id || (d.user && (d.user.id || d.user._id))));
      if (!ok) throw new Error();
    })
    .catch(() => { localStorage.clear(); location.href = 'login.html'; });
})();

(() => {
  const initDateTime = () => {
    const topEl = document.getElementById("topDate");
    const greetEl = document.getElementById("greet");
    const greetSubEl = document.getElementById("greetSub");

    const pad = n => (n < 10 ? "0" + n : String(n));

    const fmtDateTime = d => {
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${dd}-${mm}-${yyyy} | ${hh}:${mi}:${ss}`;
    };

    const getGreeting = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour >= 5 && hour < 12) {
        return { greeting: "Good Morning", message: "Have a productive day!" };
      } else if (hour >= 12 && hour < 17) {
        return { greeting: "Good Afternoon", message: "Keep up the great work!" };
      } else if (hour >= 17 && hour < 20) {
        return { greeting: "Good Evening", message: "Finish strong!" };
      } else {
        return { greeting: "Good Night", message: "Rest well, see you tomorrow!" };
      }
    };

    const tick = () => {
      const now = new Date();
      const text = fmtDateTime(now);
      if (topEl) topEl.textContent = text;

      const greetingData = getGreeting();
      if (greetEl) greetEl.textContent = greetingData.greeting;
      if (greetSubEl) greetSubEl.textContent = greetingData.message;
    };

    tick();
    setInterval(tick, 1000);
  };

  if (document.getElementById("topDate")) {
    initDateTime();
  } else {
    window.addEventListener("layoutLoaded", initDateTime);
  }
})();

(() => {
  const bodyEl = document.getElementById("calendarBody");
  if (!bodyEl) return;
  if (bodyEl.children.length > 0) return;
  const current = new Date();
  let viewYear = current.getFullYear();
  let viewMonth = current.getMonth();
  const monthYearEl = document.getElementById("monthYear");
  const nextBtn = document.getElementById("nextCal");
  const prevBtn = document.getElementById("prevCal");
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const HOLIDAY_COUNTRY = "IN";
  const holidaysByYear = {};
  const cacheKey = year => `holidays_${HOLIDAY_COUNTRY}_${year}`;
  const setCachedHolidays = (year, list) => {
    try {
      const payload = { savedAt: Date.now(), data: list };
      localStorage.setItem(cacheKey(year), JSON.stringify(payload));
    } catch (e) {}
  };
  const getCachedHolidays = year => {
    try {
      const raw = localStorage.getItem(cacheKey(year));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      if (parsed && parsed.savedAt && Date.now() - parsed.savedAt < THIRTY_DAYS) {
        return parsed.data || null;
      }
    } catch (e) {}
    return null;
  };
  const normalizeHolidays = apiList => {
    const out = [];
    for (let i = 0; i < apiList.length; i++) {
      const item = apiList[i];
      if (!item || !item.date) continue;
      const d = new Date(`${item.date}T00:00:00`);
      out.push({ month: d.getMonth(), day: d.getDate(), name: item.localName || item.name || "Holiday" });
    }
    return out;
  };
  const loadHolidays = (year, onDone) => {
    if (holidaysByYear[year]) {
      if (onDone) onDone();
      return;
    }
    const cached = getCachedHolidays(year);
    if (cached) {
      holidaysByYear[year] = cached;
      if (onDone) onDone();
      return;
    }
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${HOLIDAY_COUNTRY}`;
    fetch(url)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        let list = normalizeHolidays(Array.isArray(data) ? data : []);
        if (!list || list.length === 0) {
          list = [
            { month: 0, day: 26, name: "Republic Day" },
            { month: 7, day: 15, name: "Independence Day" },
            { month: 9, day: 2, name: "Gandhi Jayanti" },
            { month: 11, day: 25, name: "Christmas" }
          ];
        }
        holidaysByYear[year] = list;
        setCachedHolidays(year, list);
      })
      .catch(() => {
        holidaysByYear[year] = [
          { month: 0, day: 26, name: "Republic Day" },
          { month: 7, day: 15, name: "Independence Day" },
          { month: 9, day: 2, name: "Gandhi Jayanti" },
          { month: 11, day: 25, name: "Christmas" }
        ];
      })
      .finally(() => {
        if (onDone) onDone();
      });
  };
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getHolidayForDate = (year, month, day) => {
    const list = holidaysByYear[year];
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
      const holiday = list[i];
      if (holiday.month === month && holiday.day === day) return holiday.name;
    }
    return null;
  };
  const getDateKey = (year, month, day) => {
    const d = new Date(year, month, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const parseTimeToMinutes = timeStr => {
    if (!timeStr || timeStr === "00:00:00" || timeStr === "--:--") return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + (seconds > 0 ? 1 : 0);
  };
  const formatHoursMinutes = totalMinutes => {
    if (totalMinutes === 0) return "";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };
  const calculateWeeklyHours = (y, m, weekStart, weekEnd) => {
    let totalMinutes = 0;
    for (let d = weekStart; d <= weekEnd; d++) {
      if (d > 0 && d <= daysInMonth(y, m)) {
        const dateKey = getDateKey(y, m, d);
        const storedHours = localStorage.getItem(`workHours_${dateKey}`);
        if (storedHours) totalMinutes += parseTimeToMinutes(storedHours);
      }
    }
    return totalMinutes;
  };
  const render = (y, m) => {
    bodyEl.innerHTML = "";
    const firstDay = new Date(y, m, 1).getDay();
    const totalDays = daysInMonth(y, m);
    let day = 1;
    if (monthYearEl) monthYearEl.textContent = `${monthNames[m]} ${y}`;
    for (let r = 0; r < 6; r++) {
      const tr = document.createElement("tr");
      let weekStart = null;
      let weekEnd = null;
      for (let c = 0; c < 7; c++) {
        const td = document.createElement("td");
        if ((r === 0 && c < firstDay) || day > totalDays) {
          td.textContent = "";
        } else {
          td.textContent = String(day);
          if (weekStart === null) weekStart = day;
          weekEnd = day;
          const today = new Date();
          if (y === today.getFullYear() && m === today.getMonth() && day === today.getDate()) {
            td.classList.add("today");
          }
          if (c === 0 || c === 6) {
            td.classList.add("weekend");
          }
          const holidayName = getHolidayForDate(y, m, day);
          if (holidayName) {
            td.classList.add("holiday");
            td.setAttribute("data-holiday", holidayName);
            td.title = holidayName;
          }
          day++;
        }
        tr.appendChild(td);
      }
      const weeklyTd = document.createElement("td");
      weeklyTd.classList.add("weekly-hours");
      if (weekStart !== null && weekStart <= totalDays) {
        const actualWeekEnd = weekEnd > totalDays ? totalDays : weekEnd;
        const weeklyMinutes = calculateWeeklyHours(y, m, weekStart, actualWeekEnd);
        weeklyTd.textContent = formatHoursMinutes(weeklyMinutes);
      } else {
        weeklyTd.textContent = "";
      }
      tr.appendChild(weeklyTd);
      bodyEl.appendChild(tr);
    }
  };
  const next = () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    loadHolidays(viewYear, () => render(viewYear, viewMonth));
  };
  const prev = () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    loadHolidays(viewYear, () => render(viewYear, viewMonth));
  };
  const calendarState = { viewYear, viewMonth, render };
  const originalNext = next;
  const originalPrev = prev;
  const wrappedNext = () => {
    originalNext();
    calendarState.viewYear = viewYear;
    calendarState.viewMonth = viewMonth;
  };
  const wrappedPrev = () => {
    originalPrev();
    calendarState.viewYear = viewYear;
    calendarState.viewMonth = viewMonth;
  };
  if (nextBtn) nextBtn.addEventListener("click", wrappedNext);
  if (prevBtn) prevBtn.addEventListener("click", wrappedPrev);
  loadHolidays(viewYear, () => render(viewYear, viewMonth));
  window.updateCalendar = () => {
    calendarState.render(calendarState.viewYear, calendarState.viewMonth);
  };
})();

(() => {
  const punchInBtn = document.getElementById("btnPunch");
  const punchOutBtn = document.getElementById("btnPunchOut");
  const halfDayBtn = document.getElementById("btnHalf");
  const workTimerEl = document.getElementById("workTimer");
  const punchInTimeEl = document.getElementById("punchInTime");
  const punchOutTimeEl = document.getElementById("punchOutTime");
  const bigCircleEl = document.getElementById("bigCircle");
  const statusDotEl = document.getElementById("statusDot");
  const progressFillEl = document.getElementById("progressFill");
  const MAX_PROGRESS_HOURS = 9;
  let timerInterval = null;
  let startTime = null;
  let isPunchedIn = false;

  const pad = n => (n < 10 ? "0" + n : String(n));
  const formatTime = (hours, minutes, seconds) => `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const formatTimeShort = (hours, minutes) => `${pad(hours)}:${pad(minutes)}`;
  const getDateKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const updateProgress = hours => {
    if (!progressFillEl) return;
    let ratio = hours / MAX_PROGRESS_HOURS;
    if (!isFinite(ratio)) ratio = 0;
    ratio = Math.max(0, Math.min(ratio, 1));
    const degrees = ratio * 360;
    progressFillEl.style.setProperty("--progress", `${degrees}deg`);
  };

  const updateCircleStatus = hours => {
    if (!bigCircleEl || !statusDotEl) return;
    bigCircleEl.classList.remove("status-pending", "status-working", "status-halfday", "status-fullday", "status-overtime");
    statusDotEl.classList.remove("pending", "working", "halfday", "fullday", "overtime");
    let progressColor = "#0da4d6";
    if (hours === 0 && !isPunchedIn) {
      bigCircleEl.classList.add("status-pending");
      statusDotEl.classList.add("pending");
      statusDotEl.title = "Not Started";
      progressColor = "#6b6b6b";
    } else if (isPunchedIn && hours < 5) {
      bigCircleEl.classList.add("status-working");
      statusDotEl.classList.add("working");
      statusDotEl.title = "Working";
      progressColor = "#0da4d6";
    } else if (hours >= 5 && hours < 8) {
      bigCircleEl.classList.add("status-halfday");
      statusDotEl.classList.add("halfday");
      statusDotEl.title = "Half Day";
      progressColor = "#ffc107";
    } else if (hours >= 8 && hours < 9) {
      bigCircleEl.classList.add("status-fullday");
      statusDotEl.classList.add("fullday");
      statusDotEl.title = "Full Day";
      progressColor = "#4caf50";
    } else if (hours >= 9) {
      bigCircleEl.classList.add("status-overtime");
      statusDotEl.classList.add("overtime");
      statusDotEl.title = "Overtime";
      progressColor = "#ff7a1a";
    } else {
      bigCircleEl.classList.add("status-working");
      statusDotEl.classList.add("working");
      statusDotEl.title = "Working";
      progressColor = "#0da4d6";
    }
    if (progressFillEl) {
      progressFillEl.style.setProperty("--progress-color", progressColor);
    }
  };

  const updateTimer = () => {
    if (!startTime || !workTimerEl) return;
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    workTimerEl.textContent = formatTime(hours, minutes, seconds);
    const totalHours = diff / 3600;
    updateCircleStatus(totalHours);
    updateProgress(totalHours);
    if (halfDayBtn && punchOutBtn) {
      if (isPunchedIn && totalHours >= 5 && totalHours < 8) {
        halfDayBtn.disabled = false;
        halfDayBtn.style.opacity = "1";
        punchOutBtn.disabled = true;
        punchOutBtn.style.opacity = "0.5";
        punchOutBtn.title = "Punch-out disabled between 5 and 8 hours. Use Half-day.";
      } else if (isPunchedIn && totalHours >= 8) {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = false;
        punchOutBtn.style.opacity = "1";
        punchOutBtn.title = "Punch-out enabled";
      } else if (isPunchedIn) {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = false;
        punchOutBtn.style.opacity = "1";
        punchOutBtn.title = "Punch-out enabled";
      } else {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = true;
        punchOutBtn.style.opacity = "0.5";
        punchOutBtn.title = "Start work to enable punch-out";
      }
    } else if (halfDayBtn) {
      if (isPunchedIn && totalHours >= 5) {
        halfDayBtn.disabled = false;
        halfDayBtn.style.opacity = "1";
      } else {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
      }
    }
  };

  const startTimer = existingStartTime => {
    if (timerInterval) return;
    if (existingStartTime instanceof Date && !isNaN(existingStartTime)) {
      startTime = existingStartTime;
    } else {
      startTime = new Date();
    }
    isPunchedIn = true;
    const punchInTime = formatTimeShort(startTime.getHours(), startTime.getMinutes());
    if (punchInTimeEl) punchInTimeEl.textContent = punchInTime;
    const dateKey = getDateKey();
    if (!localStorage.getItem(`punchIn_${dateKey}`)) {
      localStorage.setItem(`punchIn_${dateKey}`, punchInTime);
    }
    if (!(existingStartTime instanceof Date)) {
      localStorage.setItem(`punchInTime_${dateKey}`, startTime.toISOString());
    }
    if (punchOutTimeEl) punchOutTimeEl.textContent = "--:--";
    localStorage.removeItem(`punchOut_${dateKey}`);
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
    if (punchInBtn) {
      punchInBtn.disabled = true;
      punchInBtn.style.opacity = "0.5";
    }
    if (punchOutBtn) {
      punchOutBtn.disabled = false;
      punchOutBtn.style.opacity = "1";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  const stopTimer = (overrideHours, overrideTimerText, options) => {
    const opts = options || {};
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isPunchedIn = false;
    let finalHours = 0;
    const now = new Date();
    if (typeof overrideHours === "number" && !isNaN(overrideHours)) {
      finalHours = overrideHours;
    } else if (startTime && workTimerEl) {
      const diff = Math.floor((now - startTime) / 1000);
      finalHours = diff / 3600;
    }
    const punchOutTime = formatTimeShort(now.getHours(), now.getMinutes());
    if (punchOutTimeEl) punchOutTimeEl.textContent = punchOutTime;
    const dateKey = getDateKey();
    localStorage.setItem(`punchOut_${dateKey}`, punchOutTime);
    const timerValue = overrideTimerText || (workTimerEl ? workTimerEl.textContent || "00:00:00" : "00:00:00");
    if (workTimerEl && overrideTimerText) workTimerEl.textContent = overrideTimerText;
    if (workTimerEl) {
      localStorage.setItem(`workHours_${dateKey}`, timerValue);
      if (opts.forceHalfDay) {
        localStorage.setItem(`halfDay_${dateKey}`, "true");
        localStorage.removeItem(`fullDay_${dateKey}`);
      } else if (finalHours >= 5 && finalHours < 8) {
        localStorage.setItem(`halfDay_${dateKey}`, "true");
        localStorage.removeItem(`fullDay_${dateKey}`);
      } else if (finalHours >= 8) {
        localStorage.setItem(`fullDay_${dateKey}`, "true");
        localStorage.removeItem(`halfDay_${dateKey}`);
      } else {
        localStorage.removeItem(`halfDay_${dateKey}`);
        localStorage.removeItem(`fullDay_${dateKey}`);
      }
    }
    updateCircleStatus(finalHours);
    updateProgress(finalHours);
    startTime = null;
    if (typeof window.updateCalendar === "function") {
      setTimeout(() => {
        window.updateCalendar();
      }, 100);
    }
    if (typeof window.refreshpunchInOut === "function") {
      setTimeout(() => {
        window.refreshpunchInOut();
      }, 100);
    }
    if (punchInBtn) {
      punchInBtn.disabled = false;
      punchInBtn.style.opacity = "1";
    }
    if (punchOutBtn) {
      punchOutBtn.disabled = true;
      punchOutBtn.style.opacity = "0.5";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  const handleHalfDay = () => {
    const now = new Date();
    let currentHours = 0;
    if (startTime) {
      const diff = Math.floor((now - startTime) / 1000);
      currentHours = diff / 3600;
    }
    if (currentHours < 5) {
      alert("Half Day is available only after 5 hours of work.");
      return;
    }
    const halfDayHours = Math.min(Math.max(currentHours, 5), 8);
    const hours = Math.floor(halfDayHours);
    const minutes = Math.floor((halfDayHours - hours) * 60);
    const seconds = Math.floor(((halfDayHours - hours) * 60 - minutes) * 60);
    const timerValue = formatTime(hours, minutes, seconds);
    try {
      const now2 = new Date();
      const dateKey = getDateKey();
      const time = `${now2.getHours()}:${now2.getMinutes()}:${now2.getSeconds()}`;
      fetch("http://localhost:5000/attendance/punchout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": localStorage.getItem("token")
        },
        body: JSON.stringify({
          date: dateKey,
          time,
          totalHours: timerValue,
          forceHalfDay: true
        })
      }).catch(()=>{});
    } catch(e){}
    stopTimer(halfDayHours, timerValue, { forceHalfDay: true });
  };

  const loadSavedData = () => {
    const dateKey = getDateKey();
    const savedPunchIn = localStorage.getItem(`punchIn_${dateKey}`);
    const savedPunchOut = localStorage.getItem(`punchOut_${dateKey}`);
    const savedWorkHours = localStorage.getItem(`workHours_${dateKey}`);
    if (savedPunchIn && punchInTimeEl) punchInTimeEl.textContent = savedPunchIn;
    if (savedPunchOut && punchOutTimeEl) punchOutTimeEl.textContent = savedPunchOut;
    if (savedPunchOut && savedWorkHours && workTimerEl) {
      workTimerEl.textContent = savedWorkHours;
      const parts = savedWorkHours.split(":");
      if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const totalHours = hours + minutes / 60;
        updateCircleStatus(totalHours);
        updateProgress(totalHours);
      }
    }
    const savedStartTime = localStorage.getItem(`punchInTime_${dateKey}`);
    if (savedStartTime && !savedPunchOut) {
      const resumeStart = new Date(savedStartTime);
      if (!isNaN(resumeStart)) {
        startTimer(resumeStart);
        if (punchInBtn) {
          punchInBtn.disabled = true;
          punchInBtn.style.opacity = "0.5";
        }
      } else {
        updateCircleStatus(0);
        updateProgress(0);
      }
    } else {
      updateCircleStatus(0);
      updateProgress(0);
    }
    if (punchInBtn && !isPunchedIn && !savedPunchOut && !savedStartTime) {
      punchInBtn.disabled = false;
      punchInBtn.style.opacity = "1";
    }
    if (punchOutBtn && (!isPunchedIn || savedPunchOut)) {
      punchOutBtn.disabled = true;
      punchOutBtn.style.opacity = "0.5";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  if (punchInBtn) {
    punchInBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      const alreadyPunchedIn = !!localStorage.getItem(`punchInTime_${dateKey}`);
      const alreadyPunchedOut = !!localStorage.getItem(`punchOut_${dateKey}`);
      if (alreadyPunchedIn && !alreadyPunchedOut) {
        alert("You are already punched in.");
        return;
      }
      if (alreadyPunchedOut) {
        alert("Today's punch out already recorded.");
        return;
      }
      localStorage.setItem(`punchInTime_${dateKey}`, new Date().toISOString());
      startTimer();
      try {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        fetch("http://localhost:5000/attendance/punchin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": localStorage.getItem("token")
          },
          body: JSON.stringify({
            date: dateKey,
            time,
            timeIso: now.toISOString()
          })
        }).catch(()=>{});
      } catch (e){}
    });
  }

  if (punchOutBtn) {
    punchOutBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      if (localStorage.getItem(`punchOut_${dateKey}`)) {
        alert("You have already punched out today.");
        return;
      }
      localStorage.removeItem(`punchInTime_${dateKey}`);
      try {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        const totalHours = workTimerEl ? workTimerEl.textContent || "00:00:00" : "00:00:00";
        fetch("http://localhost:5000/attendance/punchout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": localStorage.getItem("token")
          },
          body: JSON.stringify({
            date: dateKey,
            time,
            totalHours
          })
        }).catch(()=>{});
      } catch(e){}
      stopTimer();
    });
  }

  if (halfDayBtn) {
    halfDayBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      localStorage.removeItem(`punchInTime_${dateKey}`);
      handleHalfDay();
    });
  }

  if (typeof window.syncFromServer === "function") {
    window.syncFromServer().catch(()=>{});
  }
  loadSavedData();
  if (punchInBtn && !isPunchedIn) {
    punchInBtn.disabled = false;
    punchInBtn.style.opacity = "1";
  }
  if (punchOutBtn && !isPunchedIn) {
    punchOutBtn.disabled = true;
    punchOutBtn.style.opacity = "0.5";
  }
  if (halfDayBtn && !isPunchedIn) {
    halfDayBtn.disabled = true;
    halfDayBtn.style.opacity = "0.5";
  }
})();

(() => {
  const container = document.getElementById("punchInContainer");
  const prevBtn = document.getElementById("punchInPrev");
  const nextBtn = document.getElementById("punchInNext");
  if (!container) return;
  let currentStartDay = 4;
  const MAX_DAYS = 5;
  const pad = n => (n < 10 ? "0" + n : String(n));
  const getDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatTimeShort = (hours, minutes) => `${pad(hours)}:${pad(minutes)}`;
  const parseTimeToMinutes = timeStr => {
    if (!timeStr || timeStr === "00:00:00" || timeStr === "--:--") return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + (seconds > 0 ? 1 : 0);
  };
  const formatHoursMinutes = totalMinutes => {
    if (totalMinutes === 0) return "--";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };
  const getDayName = date => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const getStatusClass = dateKey => {
    const halfDay = localStorage.getItem(`halfDay_${dateKey}`);
    const fullDay = localStorage.getItem(`fullDay_${dateKey}`);
    const leaveData = localStorage.getItem(`leave_${dateKey}`);
    const punchIn = localStorage.getItem(`punchIn_${dateKey}`);
    const punchOut = localStorage.getItem(`punchOut_${dateKey}`);
    if (leaveData) return "leave";
    if (halfDay) return "halfday";
    if (fullDay) return "present";
    const date = new Date(dateKey);
    const now = new Date();
    if (punchIn && !punchOut) {
      if (
        now.getFullYear() === date.getFullYear() &&
        now.getMonth() === date.getMonth() &&
        now.getDate() === date.getDate()
      ) {
        if (now.getHours() < 23 || (now.getHours() === 23 && now.getMinutes() < 59)) {
          return "present";
        } else {
          return "missedout";
        }
      } else if (now > date) {
        return "missedout";
      }
    }
    if (date < now && !punchIn) return "absent";
    return "present";
  };
  const getStatusText = statusClass => {
    const statusMap = { present: "✓", halfday: "½", leave: "L", absent: "✕", missedout: "✕" };
    return statusMap[statusClass] || "";
  };
  const render = startDayOffset => {
    container.innerHTML = "";
    for (let i = MAX_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (startDayOffset - i));
      date.setHours(0, 0, 0, 0);
      const dateKey = getDateKey(date);
      const punchIn = localStorage.getItem(`punchIn_${dateKey}`) || "--:--";
      const punchOut = localStorage.getItem(`punchOut_${dateKey}`) || "--:--";
      const workHours = localStorage.getItem(`workHours_${dateKey}`) || "00:00:00";
      const statusClass = getStatusClass(dateKey);
      const statusText = getStatusText(statusClass);
      const minutes = parseTimeToMinutes(workHours);
      const duration = formatHoursMinutes(minutes);
      const dayDiv = document.createElement("div");
      dayDiv.className = "punchin-day";
      const dateDiv = document.createElement("div");
      dateDiv.className = "day-date";
      const dateValue = document.createElement("div");
      dateValue.textContent = `${date.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()]}`;
      const dateLabel = document.createElement("div");
      dateLabel.className = "day-date-label";
      dateLabel.textContent = getDayName(date);
      dateDiv.appendChild(dateValue);
      dateDiv.appendChild(dateLabel);
      const timesDiv = document.createElement("div");
      timesDiv.className = "day-times";
      const punchInBlock = document.createElement("div");

      punchInBlock.className = "time-block";
      const punchInLabel = document.createElement("div");
      punchInLabel.className = "time-label";
      punchInLabel.textContent = "punch-in";
      const punchInValue = document.createElement("div");
      punchInValue.className = "time-value";
      punchInValue.textContent = punchIn;
      punchInBlock.appendChild(punchInLabel);
      punchInBlock.appendChild(punchInValue);
      const punchOutBlock = document.createElement("div");
      punchOutBlock.className = "time-block";
      const punchOutLabel = document.createElement("div");
      punchOutLabel.className = "time-label";
      punchOutLabel.textContent = "punch-out";
      const punchOutValue = document.createElement("div");
      punchOutValue.className = "time-value";
      punchOutValue.textContent = punchOut;
      punchOutBlock.appendChild(punchOutLabel);
      punchOutBlock.appendChild(punchOutValue);
      timesDiv.appendChild(punchInBlock);
      timesDiv.appendChild(punchOutBlock);
      const durationDiv = document.createElement("div");
      durationDiv.className = "day-duration";
      const durationLabel = document.createElement("div");
      durationLabel.className = "duration-label";
      durationLabel.textContent = "Duration";
      const durationValue = document.createElement("div");
      durationValue.className = "duration-value";
      durationValue.textContent = duration;
      durationDiv.appendChild(durationLabel);
      durationDiv.appendChild(durationValue);
      const statusDiv = document.createElement("div");
      statusDiv.className = `day-status ${statusClass}`;
      statusDiv.textContent = statusText;
      statusDiv.title = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
      dayDiv.appendChild(dateDiv);
      dayDiv.appendChild(timesDiv);
      dayDiv.appendChild(durationDiv);
      dayDiv.appendChild(statusDiv);
      container.appendChild(dayDiv);
    }
    if (prevBtn && nextBtn) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const earliestShown = new Date();
      earliestShown.setDate(earliestShown.getDate() - startDayOffset);
      earliestShown.setHours(0, 0, 0, 0);
      const latestShown = new Date();
      latestShown.setDate(latestShown.getDate() - (startDayOffset - (MAX_DAYS - 1)));
      latestShown.setHours(0, 0, 0, 0);
      nextBtn.disabled = latestShown >= today;
      prevBtn.disabled = startDayOffset >= 60;
      nextBtn.title = nextBtn.disabled ? "No newer days" : "Show newer days";
      prevBtn.title = prevBtn.disabled ? "No older days" : "Show older days";
    }
  };
  const goNext = () => {
    if (currentStartDay > 0) {
      currentStartDay--;
      render(currentStartDay);
    }
  };
  const goPrev = () => {
    if (currentStartDay < 60) {
      currentStartDay++;
      render(currentStartDay);
    }
  };
  if (prevBtn) prevBtn.addEventListener("click", goPrev);
  if (nextBtn) nextBtn.addEventListener("click", goNext);
  render(currentStartDay);
  window.refreshpunchInOut = () => {
    render(currentStartDay);
  };
})();
(() => {
  const API_BASE = "http://localhost:5000";
  const tokenKey = "token";
  const userIdKey = "userId";
  const userNameKey = "userName";

  const apiFetch = async (path, opts = {}) => {
    const headers = opts.headers || {};
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    const token = localStorage.getItem(tokenKey);
    if (token) headers["auth-token"] = token;
    const cfg = Object.assign({}, opts, { headers });
    try {
      const res = await fetch(API_BASE + path, cfg);
      const txt = await res.text();
      try { return JSON.parse(txt); } catch(e) { return { raw: txt, status: res.status }; }
    } catch (e) {
      return null;
    }
  };

  const syncFromServer = async () => {
    const token = localStorage.getItem(tokenKey);
    if (!token) return;
    
    const att = await apiFetch("/attendance/history", { method: "GET" });
    if (att && Array.isArray(att)) {
      att.forEach(a => {
        try {
          const dateKey = a.date;
          if (a.punchIn) localStorage.setItem(`punchIn_${dateKey}`, a.punchIn);
          if (a.punchOut) localStorage.setItem(`punchOut_${dateKey}`, a.punchOut);
          if (a.totalHours) localStorage.setItem(`workHours_${dateKey}`, a.totalHours);
          if (a.status === "halfday") localStorage.setItem(`halfDay_${dateKey}`, "true");
          if (a.status === "present" || a.status === "fullday" || a.status === "fullDay") localStorage.setItem(`fullDay_${dateKey}`, "true");
          if (a.status === "leave") localStorage.setItem(`leave_${dateKey}`, "true");
        } catch (e) {}
      });
    }
    
    const leaves = await apiFetch("/leave", { method: "GET" });
    if (leaves && Array.isArray(leaves)) {
      leaves.forEach(l => {
        try {
          localStorage.setItem(`leave_${l.date}`, "true");
          if (l.reason) localStorage.setItem(`leaveReason_${l.date}`, l.reason);
        } catch (e) {}
      });
    }
  };

  window.syncFromServer = syncFromServer;
})();

(() => {
  const initDateTime = () => {
    const topEl = document.getElementById("topDate");
    const greetEl = document.getElementById("greet");
    const greetSubEl = document.getElementById("greetSub");

    const pad = n => (n < 10 ? "0" + n : String(n));

    const fmtDateTime = d => {
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${dd}-${mm}-${yyyy} | ${hh}:${mi}:${ss}`;
    };

    const getGreeting = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour >= 5 && hour < 12) {
        return { greeting: "Good Morning", message: "Have a productive day!" };
      } else if (hour >= 12 && hour < 17) {
        return { greeting: "Good Afternoon", message: "Keep up the great work!" };
      } else if (hour >= 17 && hour < 20) {
        return { greeting: "Good Evening", message: "Finish strong!" };
      } else {
        return { greeting: "Good Night", message: "Rest well, see you tomorrow!" };
      }
    };

    const tick = () => {
      const now = new Date();
      const text = fmtDateTime(now);
      if (topEl) topEl.textContent = text;

      const greetingData = getGreeting();
      if (greetEl) greetEl.textContent = greetingData.greeting;
      if (greetSubEl) greetSubEl.textContent = greetingData.message;
    };

    tick();
    setInterval(tick, 1000);
  };

  if (document.getElementById("topDate")) {
    initDateTime();
  } else {
    window.addEventListener("layoutLoaded", initDateTime);
  }
})();

(() => {
  const bodyEl = document.getElementById("calendarBody");
  if (!bodyEl) return;
  if (bodyEl.children.length > 0) return;
  const current = new Date();
  let viewYear = current.getFullYear();
  let viewMonth = current.getMonth();
  const monthYearEl = document.getElementById("monthYear");
  const nextBtn = document.getElementById("nextCal");
  const prevBtn = document.getElementById("prevCal");
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const HOLIDAY_COUNTRY = "IN";
  const holidaysByYear = {};
  const cacheKey = year => `holidays_${HOLIDAY_COUNTRY}_${year}`;
  const setCachedHolidays = (year, list) => {
    try {
      const payload = { savedAt: Date.now(), data: list };
      localStorage.setItem(cacheKey(year), JSON.stringify(payload));
    } catch (e) {}
  };
  const getCachedHolidays = year => {
    try {
      const raw = localStorage.getItem(cacheKey(year));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      if (parsed && parsed.savedAt && Date.now() - parsed.savedAt < THIRTY_DAYS) {
        return parsed.data || null;
      }
    } catch (e) {}
    return null;
  };
  const normalizeHolidays = apiList => {
    const out = [];
    for (let i = 0; i < apiList.length; i++) {
      const item = apiList[i];
      if (!item || !item.date) continue;
      const d = new Date(`${item.date}T00:00:00`);
      out.push({ month: d.getMonth(), day: d.getDate(), name: item.localName || item.name || "Holiday" });
    }
    return out;
  };
  const loadHolidays = (year, onDone) => {
    if (holidaysByYear[year]) {
      if (onDone) onDone();
      return;
    }
    const cached = getCachedHolidays(year);
    if (cached) {
      holidaysByYear[year] = cached;
      if (onDone) onDone();
      return;
    }
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${HOLIDAY_COUNTRY}`;
    fetch(url)
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        let list = normalizeHolidays(Array.isArray(data) ? data : []);
        if (!list || list.length === 0) {
          list = [
            { month: 0, day: 26, name: "Republic Day" },
            { month: 7, day: 15, name: "Independence Day" },
            { month: 9, day: 2, name: "Gandhi Jayanti" },
            { month: 11, day: 25, name: "Christmas" }
          ];
        }
        holidaysByYear[year] = list;
        setCachedHolidays(year, list);
      })
      .catch(() => {
        holidaysByYear[year] = [
          { month: 0, day: 26, name: "Republic Day" },
          { month: 7, day: 15, name: "Independence Day" },
          { month: 9, day: 2, name: "Gandhi Jayanti" },
          { month: 11, day: 25, name: "Christmas" }
        ];
      })
      .finally(() => {
        if (onDone) onDone();
      });
  };
  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getHolidayForDate = (year, month, day) => {
    const list = holidaysByYear[year];
    if (!list) return null;
    for (let i = 0; i < list.length; i++) {
      const holiday = list[i];
      if (holiday.month === month && holiday.day === day) return holiday.name;
    }
    return null;
  };
  const getDateKey = (year, month, day) => {
    const d = new Date(year, month, day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const parseTimeToMinutes = timeStr => {
    if (!timeStr || timeStr === "00:00:00" || timeStr === "--:--") return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + (seconds > 0 ? 1 : 0);
  };
  const formatHoursMinutes = totalMinutes => {
    if (totalMinutes === 0) return "";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };
  const calculateWeeklyHours = (y, m, weekStart, weekEnd) => {
    let totalMinutes = 0;
    for (let d = weekStart; d <= weekEnd; d++) {
      if (d > 0 && d <= daysInMonth(y, m)) {
        const dateKey = getDateKey(y, m, d);
        const storedHours = localStorage.getItem(`workHours_${dateKey}`);
        if (storedHours) totalMinutes += parseTimeToMinutes(storedHours);
      }
    }
    return totalMinutes;
  };
  const render = (y, m) => {
    bodyEl.innerHTML = "";
    const firstDay = new Date(y, m, 1).getDay();
    const totalDays = daysInMonth(y, m);
    let day = 1;
    if (monthYearEl) monthYearEl.textContent = `${monthNames[m]} ${y}`;
    for (let r = 0; r < 6; r++) {
      const tr = document.createElement("tr");
      let weekStart = null;
      let weekEnd = null;
      for (let c = 0; c < 7; c++) {
        const td = document.createElement("td");
        if ((r === 0 && c < firstDay) || day > totalDays) {
          td.textContent = "";
        } else {
          td.textContent = String(day);
          if (weekStart === null) weekStart = day;
          weekEnd = day;
          const today = new Date();
          if (y === today.getFullYear() && m === today.getMonth() && day === today.getDate()) {
            td.classList.add("today");
          }
          if (c === 0 || c === 6) {
            td.classList.add("weekend");
          }
          const holidayName = getHolidayForDate(y, m, day);
          if (holidayName) {
            td.classList.add("holiday");
            td.setAttribute("data-holiday", holidayName);
            td.title = holidayName;
          }
          day++;
        }
        tr.appendChild(td);
      }
      const weeklyTd = document.createElement("td");
      weeklyTd.classList.add("weekly-hours");
      if (weekStart !== null && weekStart <= totalDays) {
        const actualWeekEnd = weekEnd > totalDays ? totalDays : weekEnd;
        const weeklyMinutes = calculateWeeklyHours(y, m, weekStart, actualWeekEnd);
        weeklyTd.textContent = formatHoursMinutes(weeklyMinutes);
      } else {
        weeklyTd.textContent = "";
      }
      tr.appendChild(weeklyTd);
      bodyEl.appendChild(tr);
    }
  };
  const next = () => {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    loadHolidays(viewYear, () => render(viewYear, viewMonth));
  };
  const prev = () => {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    loadHolidays(viewYear, () => render(viewYear, viewMonth));
  };
  const calendarState = { viewYear, viewMonth, render };
  const originalNext = next;
  const originalPrev = prev;
  const wrappedNext = () => {
    originalNext();
    calendarState.viewYear = viewYear;
    calendarState.viewMonth = viewMonth;
  };
  const wrappedPrev = () => {
    originalPrev();
    calendarState.viewYear = viewYear;
    calendarState.viewMonth = viewMonth;
  };
  if (nextBtn) nextBtn.addEventListener("click", wrappedNext);
  if (prevBtn) prevBtn.addEventListener("click", wrappedPrev);
  loadHolidays(viewYear, () => render(viewYear, viewMonth));
  window.updateCalendar = () => {
    calendarState.render(calendarState.viewYear, calendarState.viewMonth);
  };
})();

(() => {
  const punchInBtn = document.getElementById("btnPunch");
  const punchOutBtn = document.getElementById("btnPunchOut");
  const halfDayBtn = document.getElementById("btnHalf");
  const workTimerEl = document.getElementById("workTimer");
  const punchInTimeEl = document.getElementById("punchInTime");
  const punchOutTimeEl = document.getElementById("punchOutTime");
  const bigCircleEl = document.getElementById("bigCircle");
  const statusDotEl = document.getElementById("statusDot");
  const progressFillEl = document.getElementById("progressFill");
  const MAX_PROGRESS_HOURS = 9;
  let timerInterval = null;
  let startTime = null;
  let isPunchedIn = false;

  const pad = n => (n < 10 ? "0" + n : String(n));
  const formatTime = (hours, minutes, seconds) => `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const formatTimeShort = (hours, minutes) => `${pad(hours)}:${pad(minutes)}`;
  const getDateKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  const updateProgress = hours => {
    if (!progressFillEl) return;
    let ratio = hours / MAX_PROGRESS_HOURS;
    if (!isFinite(ratio)) ratio = 0;
    ratio = Math.max(0, Math.min(ratio, 1));
    const degrees = ratio * 360;
    progressFillEl.style.setProperty("--progress", `${degrees}deg`);
  };

  const updateCircleStatus = hours => {
    if (!bigCircleEl || !statusDotEl) return;
    bigCircleEl.classList.remove("status-pending", "status-working", "status-halfday", "status-fullday", "status-overtime");
    statusDotEl.classList.remove("pending", "working", "halfday", "fullday", "overtime");
    let progressColor = "#0da4d6";
    if (hours === 0 && !isPunchedIn) {
      bigCircleEl.classList.add("status-pending");
      statusDotEl.classList.add("pending");
      statusDotEl.title = "Not Started";
      progressColor = "#6b6b6b";
    } else if (isPunchedIn && hours < 5) {
      bigCircleEl.classList.add("status-working");
      statusDotEl.classList.add("working");
      statusDotEl.title = "Working";
      progressColor = "#0da4d6";
    } else if (hours >= 5 && hours < 8) {
      bigCircleEl.classList.add("status-halfday");
      statusDotEl.classList.add("halfday");
      statusDotEl.title = "Half Day";
      progressColor = "#ffc107";
    } else if (hours >= 8 && hours < 9) {
      bigCircleEl.classList.add("status-fullday");
      statusDotEl.classList.add("fullday");
      statusDotEl.title = "Full Day";
      progressColor = "#4caf50";
    } else if (hours >= 9) {
      bigCircleEl.classList.add("status-overtime");
      statusDotEl.classList.add("overtime");
      statusDotEl.title = "Overtime";
      progressColor = "#ff7a1a";
    } else {
      bigCircleEl.classList.add("status-working");
      statusDotEl.classList.add("working");
      statusDotEl.title = "Working";
      progressColor = "#0da4d6";
    }
    if (progressFillEl) {
      progressFillEl.style.setProperty("--progress-color", progressColor);
    }
  };

  const updateTimer = () => {
    if (!startTime || !workTimerEl) return;
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    workTimerEl.textContent = formatTime(hours, minutes, seconds);
    const totalHours = diff / 3600;
    updateCircleStatus(totalHours);
    updateProgress(totalHours);
    if (halfDayBtn && punchOutBtn) {
      if (isPunchedIn && totalHours >= 5 && totalHours < 8) {
        halfDayBtn.disabled = false;
        halfDayBtn.style.opacity = "1";
          punchOutBtn.disabled = true;
          punchOutBtn.style.opacity = "0.5";
          punchOutBtn.title = "Punch-out disabled between 5 and 8 hours. Use Half-day.";
      } else if (isPunchedIn && totalHours >= 8) {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = false;
        punchOutBtn.style.opacity = "1";
          punchOutBtn.title = "Punch-out enabled";
      } else if (isPunchedIn) {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = false;
        punchOutBtn.style.opacity = "1";
          punchOutBtn.title = "Punch-out enabled";
      } else {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
        punchOutBtn.disabled = true;
        punchOutBtn.style.opacity = "0.5";
          punchOutBtn.title = "Start work to enable punch-out";
      }
    } else if (halfDayBtn) {
      if (isPunchedIn && totalHours >= 5) {
        halfDayBtn.disabled = false;
        halfDayBtn.style.opacity = "1";
      } else {
        halfDayBtn.disabled = true;
        halfDayBtn.style.opacity = "0.5";
      }
    }
  };

  const startTimer = existingStartTime => {
    if (timerInterval) return;
    if (existingStartTime instanceof Date && !isNaN(existingStartTime)) {
      startTime = existingStartTime;
    } else {
      startTime = new Date();
    }
    isPunchedIn = true;
    const punchInTime = formatTimeShort(startTime.getHours(), startTime.getMinutes());
    if (punchInTimeEl) punchInTimeEl.textContent = punchInTime;
    const dateKey = getDateKey();
    if (!localStorage.getItem(`punchIn_${dateKey}`)) {
      localStorage.setItem(`punchIn_${dateKey}`, punchInTime);
    }
    if (!(existingStartTime instanceof Date)) {
      localStorage.setItem(`punchInTime_${dateKey}`, startTime.toISOString());
    }
    if (punchOutTimeEl) punchOutTimeEl.textContent = "--:--";
    localStorage.removeItem(`punchOut_${dateKey}`);
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
    if (punchInBtn) {
      punchInBtn.disabled = true;
      punchInBtn.style.opacity = "0.5";
    }
    if (punchOutBtn) {
      punchOutBtn.disabled = false;
      punchOutBtn.style.opacity = "1";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  const stopTimer = (overrideHours, overrideTimerText, options) => {
    const opts = options || {};
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isPunchedIn = false;
    let finalHours = 0;
    const now = new Date();
    if (typeof overrideHours === "number" && !isNaN(overrideHours)) {
      finalHours = overrideHours;
    } else if (startTime && workTimerEl) {
      const diff = Math.floor((now - startTime) / 1000);
      finalHours = diff / 3600;
    }
    const punchOutTime = formatTimeShort(now.getHours(), now.getMinutes());
    if (punchOutTimeEl) punchOutTimeEl.textContent = punchOutTime;
    const dateKey = getDateKey();
    localStorage.setItem(`punchOut_${dateKey}`, punchOutTime);
    const timerValue = overrideTimerText || (workTimerEl ? workTimerEl.textContent || "00:00:00" : "00:00:00");
    if (workTimerEl && overrideTimerText) workTimerEl.textContent = overrideTimerText;
    if (workTimerEl) {
      localStorage.setItem(`workHours_${dateKey}`, timerValue);
      if (opts.forceHalfDay) {
        localStorage.setItem(`halfDay_${dateKey}`, "true");
        localStorage.removeItem(`fullDay_${dateKey}`);
      } else if (finalHours >= 5 && finalHours < 8) {
        localStorage.setItem(`halfDay_${dateKey}`, "true");
        localStorage.removeItem(`fullDay_${dateKey}`);
      } else if (finalHours >= 8) {
        localStorage.setItem(`fullDay_${dateKey}`, "true");
        localStorage.removeItem(`halfDay_${dateKey}`);
      } else {
        localStorage.removeItem(`halfDay_${dateKey}`);
        localStorage.removeItem(`fullDay_${dateKey}`);
      }
    }
    updateCircleStatus(finalHours);
    updateProgress(finalHours);
    startTime = null;
    if (typeof window.updateCalendar === "function") {
      setTimeout(() => {
        window.updateCalendar();
      }, 100);
    }
    if (typeof window.refreshpunchInOut === "function") {
      setTimeout(() => {
        window.refreshpunchInOut();
      }, 100);
    }
    if (punchInBtn) {
      punchInBtn.disabled = false;
      punchInBtn.style.opacity = "1";
    }
    if (punchOutBtn) {
      punchOutBtn.disabled = true;
      punchOutBtn.style.opacity = "0.5";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  const handleHalfDay = () => {
    const now = new Date();
    let currentHours = 0;
    if (startTime) {
      const diff = Math.floor((now - startTime) / 1000);
      currentHours = diff / 3600;
    }
    if (currentHours < 5) {
      alert("Half Day is available only after 5 hours of work.");
      return;
    }
    const halfDayHours = Math.min(Math.max(currentHours, 5), 8);
    const hours = Math.floor(halfDayHours);
    const minutes = Math.floor((halfDayHours - hours) * 60);
    const seconds = Math.floor(((halfDayHours - hours) * 60 - minutes) * 60);
    const timerValue = formatTime(hours, minutes, seconds);
    
    try {
      const now2 = new Date();
      const dateKey = getDateKey();
      const time = `${now2.getHours()}:${now2.getMinutes()}:${now2.getSeconds()}`;
      fetch("http://localhost:5000/attendance/punchout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": localStorage.getItem("token")
        },
        body: JSON.stringify({
          date: dateKey,
          time,
          totalHours: timerValue,
          forceHalfDay: true
        })
      }).catch(()=>{});
    } catch(e){}
    stopTimer(halfDayHours, timerValue, { forceHalfDay: true });
  };

  const loadSavedData = () => {
    const dateKey = getDateKey();
    const savedPunchIn = localStorage.getItem(`punchIn_${dateKey}`);
    const savedPunchOut = localStorage.getItem(`punchOut_${dateKey}`);
    const savedWorkHours = localStorage.getItem(`workHours_${dateKey}`);
    if (savedPunchIn && punchInTimeEl) punchInTimeEl.textContent = savedPunchIn;
    if (savedPunchOut && punchOutTimeEl) punchOutTimeEl.textContent = savedPunchOut;
    if (savedPunchOut && savedWorkHours && workTimerEl) {
      workTimerEl.textContent = savedWorkHours;
      const parts = savedWorkHours.split(":");
      if (parts.length === 3) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const totalHours = hours + minutes / 60;
        updateCircleStatus(totalHours);
        updateProgress(totalHours);
      }
    }
    const savedStartTime = localStorage.getItem(`punchInTime_${dateKey}`);
    if (savedStartTime && !savedPunchOut) {
      const resumeStart = new Date(savedStartTime);
      if (!isNaN(resumeStart)) {
        startTimer(resumeStart);
        if (punchInBtn) {
          punchInBtn.disabled = true;
          punchInBtn.style.opacity = "0.5";
        }
      } else {
        updateCircleStatus(0);
        updateProgress(0);
      }
    } else {
      updateCircleStatus(0);
      updateProgress(0);
    }
    if (punchInBtn && !isPunchedIn && !savedPunchOut && !savedStartTime) {
      punchInBtn.disabled = false;
      punchInBtn.style.opacity = "1";
    }
    if (punchOutBtn && (!isPunchedIn || savedPunchOut)) {
      punchOutBtn.disabled = true;
      punchOutBtn.style.opacity = "0.5";
    }
    if (halfDayBtn) {
      halfDayBtn.disabled = true;
      halfDayBtn.style.opacity = "0.5";
    }
  };

  if (punchInBtn) {
    punchInBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      const alreadyPunchedIn = !!localStorage.getItem(`punchInTime_${dateKey}`);
      const alreadyPunchedOut = !!localStorage.getItem(`punchOut_${dateKey}`);
      if (alreadyPunchedIn && !alreadyPunchedOut) {
        alert("You are already punched in.");
        return;
      }
      if (alreadyPunchedOut) {
        alert("Today's punch out already recorded.");
        return;
      }
      
      localStorage.setItem(`punchInTime_${dateKey}`, new Date().toISOString());
      
      startTimer();
      
      try {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        fetch("http://localhost:5000/attendance/punchin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": localStorage.getItem("token")
          },
          body: JSON.stringify({
            date: dateKey,
            time,
            timeIso: now.toISOString()
          })
        }).catch(()=>{});
      } catch (e){}
    });
  }

  if (punchOutBtn) {
    punchOutBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      if (localStorage.getItem(`punchOut_${dateKey}`)) {
        alert("You have already punched out today.");
        return;
      }
      localStorage.removeItem(`punchInTime_${dateKey}`);
      
      try {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
        const totalHours = workTimerEl ? workTimerEl.textContent || "00:00:00" : "00:00:00";
        fetch("http://localhost:5000/attendance/punchout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": localStorage.getItem("token")
          },
          body: JSON.stringify({
            date: dateKey,
            time,
            totalHours
          })
        }).catch(()=>{});
      } catch(e){}
      stopTimer();
    });
  }

  if (halfDayBtn) {
    halfDayBtn.addEventListener("click", () => {
      const dateKey = getDateKey();
      localStorage.removeItem(`punchInTime_${dateKey}`);
      handleHalfDay();
    });
  }

  if (typeof window.syncFromServer === "function") {
    window.syncFromServer().catch(()=>{});
  }
  loadSavedData();
  if (punchInBtn && !isPunchedIn) {
    punchInBtn.disabled = false;
    punchInBtn.style.opacity = "1";
  }
  if (punchOutBtn && !isPunchedIn) {
    punchOutBtn.disabled = true;
    punchOutBtn.style.opacity = "0.5";
  }
  if (halfDayBtn && !isPunchedIn) {
    halfDayBtn.disabled = true;
    halfDayBtn.style.opacity = "0.5";
  }
})();

(() => {
  const container = document.getElementById("punchInContainer");
  const prevBtn = document.getElementById("punchInPrev");
  const nextBtn = document.getElementById("punchInNext");
  if (!container) return;
  let currentStartDay = 4;
  const MAX_DAYS = 5;
  const pad = n => (n < 10 ? "0" + n : String(n));
  const getDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatTimeShort = (hours, minutes) => `${pad(hours)}:${pad(minutes)}`;
  const parseTimeToMinutes = timeStr => {
    if (!timeStr || timeStr === "00:00:00" || timeStr === "--:--") return 0;
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    return hours * 60 + minutes + (seconds > 0 ? 1 : 0);
  };
  const formatHoursMinutes = totalMinutes => {
    if (totalMinutes === 0) return "--";
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };
  const getDayName = date => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  const getStatusClass = dateKey => {
    const halfDay = localStorage.getItem(`halfDay_${dateKey}`);
    const fullDay = localStorage.getItem(`fullDay_${dateKey}`);
    const leaveData = localStorage.getItem(`leave_${dateKey}`);
    const punchIn = localStorage.getItem(`punchIn_${dateKey}`);
    const punchOut = localStorage.getItem(`punchOut_${dateKey}`);
    if (leaveData) return "leave";
    if (halfDay) return "halfday";
    if (fullDay) return "present";
    const date = new Date(dateKey);
    const now = new Date();
    
    if (punchIn && !punchOut) {
      
      if (
        now.getFullYear() === date.getFullYear() &&
        now.getMonth() === date.getMonth() &&
        now.getDate() === date.getDate()
      ) {
        if (now.getHours() < 23 || (now.getHours() === 23 && now.getMinutes() < 59)) {
          return "present";
        } else {
          return "missedout";
        }
      } else if (now > date) {
        
        return "missedout";
      }
    }
    
    if (date < now && !punchIn) return "absent";
    return "present";
  };
  const getStatusText = statusClass => {
    const statusMap = { present: "✓", halfday: "½", leave: "L", absent: "✕", missedout: "✕" };
    return statusMap[statusClass] || "";
  };
  const render = startDayOffset => {
    container.innerHTML = "";
    for (let i = MAX_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - (startDayOffset - i));
      date.setHours(0, 0, 0, 0);
      const dateKey = getDateKey(date);
      const punchIn = localStorage.getItem(`punchIn_${dateKey}`) || "--:--";
      const punchOut = localStorage.getItem(`punchOut_${dateKey}`) || "--:--";
      const workHours = localStorage.getItem(`workHours_${dateKey}`) || "00:00:00";
      const statusClass = getStatusClass(dateKey);
      const statusText = getStatusText(statusClass);
      const minutes = parseTimeToMinutes(workHours);
      const duration = formatHoursMinutes(minutes);
      const dayDiv = document.createElement("div");
      dayDiv.className = "punchin-day";
      const dateDiv = document.createElement("div");
      dateDiv.className = "day-date";
      const dateValue = document.createElement("div");
      dateValue.textContent = `${date.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()]}`;
      const dateLabel = document.createElement("div");
      dateLabel.className = "day-date-label";
      dateLabel.textContent = getDayName(date);
      dateDiv.appendChild(dateValue);
      dateDiv.appendChild(dateLabel);
      const timesDiv = document.createElement("div");
      timesDiv.className = "day-times";
      const punchInBlock = document.createElement("div");
  
      punchInBlock.className = "time-block";
      const punchInLabel = document.createElement("div");
      punchInLabel.className = "time-label";
      punchInLabel.textContent = "punch-in";
      const punchInValue = document.createElement("div");
      punchInValue.className = "time-value";
      punchInValue.textContent = punchIn;
      punchInBlock.appendChild(punchInLabel);
      punchInBlock.appendChild(punchInValue);
      const punchOutBlock = document.createElement("div");
      punchOutBlock.className = "time-block";
      const punchOutLabel = document.createElement("div");
      punchOutLabel.className = "time-label";
      punchOutLabel.textContent = "punch-out";
      const punchOutValue = document.createElement("div");
      punchOutValue.className = "time-value";
      punchOutValue.textContent = punchOut;
      punchOutBlock.appendChild(punchOutLabel);
      punchOutBlock.appendChild(punchOutValue);
      timesDiv.appendChild(punchInBlock);
      timesDiv.appendChild(punchOutBlock);
      const durationDiv = document.createElement("div");
      durationDiv.className = "day-duration";
      const durationLabel = document.createElement("div");
      durationLabel.className = "duration-label";
      durationLabel.textContent = "Duration";
      const durationValue = document.createElement("div");
      durationValue.className = "duration-value";
      durationValue.textContent = duration;
      durationDiv.appendChild(durationLabel);
      durationDiv.appendChild(durationValue);
      const statusDiv = document.createElement("div");
      statusDiv.className = `day-status ${statusClass}`;
      statusDiv.textContent = statusText;
      statusDiv.title = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
      dayDiv.appendChild(dateDiv);
      dayDiv.appendChild(timesDiv);
      dayDiv.appendChild(durationDiv);
      dayDiv.appendChild(statusDiv);
      container.appendChild(dayDiv);
    }
    if (prevBtn && nextBtn) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const earliestShown = new Date();
      earliestShown.setDate(earliestShown.getDate() - startDayOffset);
      earliestShown.setHours(0, 0, 0, 0);
      const latestShown = new Date();
      latestShown.setDate(latestShown.getDate() - (startDayOffset - (MAX_DAYS - 1)));
      latestShown.setHours(0, 0, 0, 0);
      
      nextBtn.disabled = latestShown >= today;
      prevBtn.disabled = startDayOffset >= 60;
      nextBtn.title = nextBtn.disabled ? "No newer days" : "Show newer days";
      prevBtn.title = prevBtn.disabled ? "No older days" : "Show older days";
      prevBtn.title = prevBtn.disabled ? "No older days" : "Show older days";
    }
  };
  const goNext = () => {
    if (currentStartDay > 0) {
      currentStartDay--;
      render(currentStartDay);
    }
  };
  const goPrev = () => {
    if (currentStartDay < 60) {
      currentStartDay++;
      render(currentStartDay);
    }
  };
  if (prevBtn) prevBtn.addEventListener("click", goPrev);
  if (nextBtn) nextBtn.addEventListener("click", goNext);
  render(currentStartDay);
  window.refreshpunchInOut = () => {
    render(currentStartDay);
  };
})();

(() => {
  const initProfile = () => {
    const nameSpan = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");
    const logoutLink = document.getElementById("logoutLink");
    const profileModal = document.getElementById("profileModal");
    const profName = document.getElementById("profName");
    const profPass = document.getElementById("profPass");
    const profCurrPass = document.getElementById("profCurrPass");
    const saveProfile = document.getElementById("saveProfile");
    const closeProfile = document.getElementById("closeProfile");
    const profileMsg = document.getElementById("profileMsg");

    const getLoggedInEmp = () => {
      try {
        const raw = localStorage.getItem("loggedInEmp");
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    };

    const getInitials = (name) => {
      if (!name) return "U";
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] || "").toUpperCase() + (parts[parts.length - 1][0] || "").toUpperCase();
      }
      return (name[0] || "U").toUpperCase();
    };

    const updateUserAvatar = () => {
      if (!userAvatar) return;
      const emp = getLoggedInEmp();
      const nm = emp && emp.name ? emp.name : localStorage.getItem("userName");
      if (nm) {
        if (nameSpan) nameSpan.textContent = nm;
        if (emp && emp.photoUrl) {
          userAvatar.innerHTML = `<img src="${emp.photoUrl}" alt="${nm}" />`;
        } else {
          userAvatar.textContent = getInitials(nm);
        }
      } else {
        if (nameSpan) nameSpan.textContent = "User";
        userAvatar.textContent = "U";
      }
    };

    updateUserAvatar();

    const settingsLink = document.getElementById("settingsLink");

    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        try {
          localStorage.removeItem("loggedInEmp");
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          localStorage.removeItem("userName");
        } catch (e) {}
        window.location.href = "login.html";
      });
    }

    if (settingsLink) {
      settingsLink.addEventListener("click", (e) => {
        e.preventDefault();
        openProfileModal();
      });
    }

    const openProfileModal = () => {
      if (profileMsg) profileMsg.textContent = "";
      const current = getLoggedInEmp() || {};
      if (profName) profName.value = current.name || "";
      if (profPass) profPass.value = "";
      if (profCurrPass) profCurrPass.value = "";
      if (profileModal) profileModal.classList.add("show");
    };

    const closeProfileModal = () => {
      if (profileModal) profileModal.classList.remove("show");
    };

    if (closeProfile) {
      closeProfile.addEventListener("click", () => {
        closeProfileModal();
      });
    }

    if (profileModal) {
      profileModal.addEventListener("click", e => {
        if (e.target === profileModal) {
          closeProfileModal();
        }
      });
    }

    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") closeProfileModal();
    });

    if (saveProfile) {
      saveProfile.addEventListener("click", () => {
        if (profileMsg) {
          profileMsg.classList.remove("error", "success");
          profileMsg.textContent = "";
        }
        const current = getLoggedInEmp() || {};
        const newPass = ((profPass && profPass.value) || "").trim();
        const currPass = ((profCurrPass && profCurrPass.value) || "").trim();

        
        if (!currPass) {
          if (profileMsg) {
            profileMsg.classList.add("error");
            profileMsg.textContent = "Current password is required.";
          }
          return;
        }

        
        const hasExistingPass = !!(current && current.pass);
        if (hasExistingPass && currPass !== current.pass) {
          if (profileMsg) {
            profileMsg.classList.add("error");
            profileMsg.textContent = "Current password is incorrect.";
          }
          return;
        }

        
        if (!newPass) {
          if (profileMsg) {
            profileMsg.classList.add("error");
            profileMsg.textContent = "Please enter a new password.";
          }
          return;
        }

        
        const updated = { name: current.name, pass: newPass, ts: Date.now() };
        if (current.photoUrl) updated.photoUrl = current.photoUrl;
        try {
          localStorage.setItem("loggedInEmp", JSON.stringify(updated));
        } catch (e) {}
        if (profileMsg) {
          profileMsg.classList.add("success");
          profileMsg.textContent = "Password updated successfully.";
        }
        setTimeout(() => {
          closeProfileModal();
        }, 1500);
      });
    }
  };

  if (document.getElementById("userAvatar")) {
    initProfile();
  } else {
    window.addEventListener("layoutLoaded", initProfile);
  }

  
  const btn = document.getElementById("loginBtn");
  const nameEl = document.getElementById("loginName");
  const passEl = document.getElementById("loginPass");
  const errEl = document.getElementById("loginErr");

  if (btn) {
    
    btn.addEventListener("click", async () => {
    const name = nameEl?.value.trim() || "";
    const pass = passEl?.value.trim() || "";

    if (!name) {
      if (errEl) errEl.textContent = "Please enter your name.";
        return;
      }

      if (!pass) {
        if (errEl) errEl.textContent = "Please enter your password.";
        return;
      }

      
      try {
        const res = await fetch("http://localhost:5000/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: name, password: pass })
        });
        const data = await res.json();
        if (data && data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("userId", data.id || data.userId || "");
          localStorage.setItem("userName", data.name || data.userName || name);
          
          localStorage.setItem("loggedInEmp", JSON.stringify({ name: data.name || name, pass }));
          window.location.href = "dashboard.html";
          return;
        } else if (data && data.error) {
          if (errEl) errEl.textContent = data.error;
          return;
        }
      } catch(e) {
        
        console.warn("Login API error, falling back to local login", e);
      }

      
      try {
        const existingEmpStr = localStorage.getItem("loggedInEmp");
        if (existingEmpStr) {
          const existingEmp = JSON.parse(existingEmpStr);
          if (existingEmp.pass && existingEmp.pass !== pass) {
            if (errEl) errEl.textContent = "Invalid password.";
            return;
          }
        }
        const payload = { name, pass, ts: Date.now() };
        localStorage.setItem("loggedInEmp", JSON.stringify(payload));
        window.location.href = "dashboard.html";
      } catch (error) {
        console.error("Error saving to localStorage:", error);
        if (errEl) errEl.textContent = "An error occurred. Please try again.";
        return;
      }
    });
  }
})();

(() => {
  const applyLeaveBtn = document.getElementById("btnApplyLeave");
  const leaveModal = document.getElementById("leaveModal");
  const closeLeave = document.getElementById("closeLeave");
  const submitLeave = document.getElementById("submitLeave");
  const leaveDate = document.getElementById("leaveDate");
  const leaveReason = document.getElementById("leaveReason");
  const leaveDaysEl = document.getElementById("leaveDays");
  const leaveRatioEl = document.getElementById("leaveRatio");

  const openLeaveModal = () => {
    if (leaveDate) leaveDate.value = "";
    if (leaveReason) leaveReason.value = "";
    if (leaveModal) leaveModal.classList.add("show");
  };

  const closeLeaveModal = () => {
    if (leaveModal) leaveModal.classList.remove("show");
  };

  const getLeaveStats = () => {
    let totalLeaves = 0;
    const leavePrefix = "leave_";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(leavePrefix)) {
        const value = localStorage.getItem(key);
        if (value === "true") totalLeaves++;
      }
    }
    return totalLeaves;
  };

  const updateLeaveStats = () => {
    const totalLeaves = getLeaveStats();
    const maxLeaves = 15;
    if (leaveDaysEl) leaveDaysEl.textContent = totalLeaves;
    if (leaveRatioEl) leaveRatioEl.textContent = `${totalLeaves} / ${maxLeaves}`;
  };

  if (applyLeaveBtn) {
    applyLeaveBtn.addEventListener("click", () => {
      openLeaveModal();
    });
  }

  if (closeLeave) {
    closeLeave.addEventListener("click", () => {
      closeLeaveModal();
    });
  }

  if (leaveModal) {
    leaveModal.addEventListener("click", e => {
      if (e.target === leaveModal) {
        closeLeaveModal();
      }
    });
  }

  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") closeLeaveModal();
  });

  if (submitLeave) {
    submitLeave.addEventListener("click", async () => {
      const dateValue = leaveDate?.value.trim();
      const reasonValue = leaveReason?.value.trim();

      if (!dateValue) {
        alert("Please select a date.");
        return;
      }

      if (!reasonValue) {
        alert("Please provide a reason.");
        return;
      }

      let serverOk = false;
      try {
        const res = await fetch("http://localhost:5000/leave/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": localStorage.getItem("token")
          },
          body: JSON.stringify({ date: dateValue, reason: reasonValue })
        });
        if (res.ok) serverOk = true;
      } catch (e) {
        console.warn("Leave API failed, falling back to localStorage", e);
      }

      try {
        localStorage.setItem(`leave_${dateValue}`, "true");
        localStorage.setItem(`leaveReason_${dateValue}`, reasonValue);
      } catch (e) {}

      updateLeaveStats();
      closeLeaveModal();
      if (serverOk) alert("Leave applied successfully (server).");
      else alert("Leave applied locally (offline).");

      if (typeof window.updateCalendar === "function") {
        setTimeout(() => {
          window.updateCalendar();
        }, 100);
      }
    });
  }

  updateLeaveStats();
})();

(() => {
  const initMenu = () => {
    const toggleBtn = document.getElementById("menuToggle");
    const sideMenu = document.getElementById("sideMenu");
    if (!toggleBtn || !sideMenu) return;
    const sideMenuInner = sideMenu.querySelector(".side-menu-inner") || sideMenu;
    const openClass = "is-open";
    const getBaseLimit = () => Math.max(window.innerHeight - 84, 320);
    const computeMenuHeight = () => {
      const reference = document.querySelector(".attendance-card") || document.querySelector(".card");
      const baseLimit = getBaseLimit();
      if (!reference) return `${baseLimit}px`;
      const refHeight = reference.offsetHeight || reference.getBoundingClientRect().height;
      const target = Math.max(260, Math.min(refHeight, baseLimit));
      return `${target}px`;
    };
    const syncMenuHeight = () => {
      sideMenuInner.style.maxHeight = computeMenuHeight();
    };
    const setState = isOpen => {
      toggleBtn.classList.toggle("open", isOpen);
      sideMenu.classList.toggle(openClass, isOpen);
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
      sideMenu.setAttribute("aria-hidden", String(!isOpen));
      document.body.classList.toggle("menu-open", isOpen);
      if (isOpen) syncMenuHeight();
    };
    setState(false);
    const toggleState = () => {
      const willOpen = !sideMenu.classList.contains(openClass);
      setState(willOpen);
    };
    toggleBtn.addEventListener("click", e => {
      e.stopPropagation();
      toggleState();
    });
    document.addEventListener("click", e => {
      if (!sideMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        setState(false);
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        setState(false);
      }
    });
    window.addEventListener("resize", () => {
      if (sideMenu.classList.contains(openClass)) {
        syncMenuHeight();
      }
    });
    const observerTarget = document.querySelector(".dashboard");
    if (observerTarget && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (sideMenu.classList.contains(openClass)) syncMenuHeight();
      });
      ro.observe(observerTarget);
    }
    syncMenuHeight();
    sideMenu.addEventListener("click", e => {
      if (e.target.closest(".side-menu-link")) {
        setState(false);
      }
    });
  };

  if (document.getElementById("menuToggle")) {
    initMenu();
  } else {
    window.addEventListener("layoutLoaded", initMenu);
  }

  const setActiveLink = () => {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const links = document.querySelectorAll('.side-menu-link');
    let activeLink = null;
    links.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
        link.classList.add('active');
        activeLink = link;
      }
    });
    if (activeLink) {
      const mainContent = document.querySelector('.side-menu-main-content');
      if (mainContent) {
        setTimeout(() => {
          activeLink.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }, 50);
      }
    }
  };

  const setupRoleBasedMenu = () => {
    const userRole = localStorage.getItem('userRole') || 'employee';
    const roleDisplay = document.getElementById('userRoleDisplay');
    
    if (roleDisplay) {
      roleDisplay.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    }

    const employeeLinks = document.querySelectorAll('.employee-only');
    const hrLinks = document.querySelectorAll('.hr-only');
    const adminSection = document.querySelector('.admin-only');
    const mainSection = document.querySelector('.side-menu-section:not(.admin-only)');

    employeeLinks.forEach(link => {
      const show = userRole === 'employee' || userRole === 'manager' || userRole === 'supervisor';
      link.style.display = show ? 'flex' : 'none';
    });

    hrLinks.forEach(link => {
      const show = userRole === 'hr' || userRole === 'admin';
      link.style.display = show ? 'flex' : 'none';
    });

    if (adminSection) {
      adminSection.style.display = userRole === 'admin' ? 'block' : 'none';
    }

    if (userRole === 'admin' && mainSection) {
      const mainLinks = mainSection.querySelectorAll('.side-menu-link');
      mainLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === 'dashboard.html' || href === 'newhire.html') {
          link.style.display = 'none';
        }
      });
    }
  };

  if (document.querySelectorAll('.side-menu-link').length > 0) {
    setActiveLink();
    setupRoleBasedMenu();
  } else {
    window.addEventListener('layoutLoaded', () => {
      setActiveLink();
      setupRoleBasedMenu();
    });
  }
})();
