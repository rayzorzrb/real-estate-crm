// ==== FIREBASE CONFIG ====
const firebaseConfig = {
  apiKey: "AIzaSyBu43KmFYNmBQfJgbz4Zq226dqaHO5J-eg",
  authDomain: "real-estate-crm-96705.firebaseapp.com",
  projectId: "real-estate-crm-96705",
  storageBucket: "real-estate-crm-96705.firebasestorage.app",
  messagingSenderId: "123357799744",
  appId: "1:123357799744:web:7340f6b436b483c9c786a5"
};

// ==== INIT FIREBASE (compat API, global `firebase`) ====
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isAdmin = false;
let leadsUnsubscribe = null;
let leadsCache = [];

// calendar state
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-11

// ======= VIEW SWITCHING =======
function showView(name) {
  const ids = ["dashboard", "newLead", "calendar", "leads"];
  ids.forEach(id => {
    const el = document.getElementById("view-" + id);
    if (!el) return;
    el.style.display = id === name ? "block" : "none";
  });
}

// ==== LOGIN ====
function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  document.getElementById("login-error").innerText = "";

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => {
      console.error(err);
      document.getElementById("login-error").innerText = err.message;
    });
}

// ==== LOGOUT ====
function logout() {
  if (leadsUnsubscribe) {
    leadsUnsubscribe();
    leadsUnsubscribe = null;
  }
  auth.signOut();
}

// ==== AUTH STATE LISTENER ====
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;

    // check if admin
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      isAdmin = userDoc.exists && userDoc.data().role === "admin";
    } catch (e) {
      console.error("Error reading user role", e);
      isAdmin = false;
    }

    document.getElementById("login-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";
    document.getElementById("top-nav").style.display = "block";

    renderCalendar();
    loadLeads();
    showView("dashboard");   // default view
  } else {
    currentUser = null;
    isAdmin = false;

    if (leadsUnsubscribe) {
      leadsUnsubscribe();
      leadsUnsubscribe = null;
    }

    document.getElementById("login-section").style.display = "block";
    document.getElementById("app-section").style.display = "none";
    document.getElementById("top-nav").style.display = "none";
    document.getElementById("lead-table").innerHTML = "";
    document.getElementById("calendar-body").innerHTML = "";
    leadsCache = [];
    updateDashboard();
  }
});

// ==== ADD LEAD ====
async function addLead() {
  if (!currentUser) {
    alert("Not logged in");
    return;
  }

  const name = document.getElementById("lead-name").value;
  const phone = document.getElementById("lead-phone").value;
  const source = document.getElementById("lead-source").value;
  const nextDate = document.getElementById("lead-nextdate").value;
  const note = document.getElementById("lead-note").value;

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    await db.collection("leads").add({
      name,
      phone,
      source,
      nextFollowupDate: nextDate || "",
      nextFollowupNote: note || "",
      assignedTo: currentUser.uid,
      assignedEmail: currentUser.email || "",
      createdAt: now,
      lastUpdated: now
    });

    document.getElementById("lead-msg").innerText = "Lead added.";

    document.getElementById("lead-name").value = "";
    document.getElementById("lead-phone").value = "";
    document.getElementById("lead-source").value = "";
    document.getElementById("lead-nextdate").value = "";
    document.getElementById("lead-note").value = "";
  } catch (e) {
    console.error(e);
    document.getElementById("lead-msg").innerText = "Error adding lead: " + e.message;
  }
}

// ==== LOAD LEADS (table + cache for dashboard & calendar) ====
function loadLeads() {
  if (!currentUser) return;

  if (leadsUnsubscribe) {
    leadsUnsubscribe();
    leadsUnsubscribe = null;
  }

  let ref = db.collection("leads");
  if (!isAdmin) {
    ref = ref.where("assignedTo", "==", currentUser.uid);
  }

  leadsUnsubscribe = ref.onSnapshot(snapshot => {
    const table = document.getElementById("lead-table");
    table.innerHTML = "";
    leadsCache = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      leadsCache.push({ id: doc.id, ...data });

      const nextDate = data.nextFollowupDate || data.nextDate || "";
      const followNote = data.nextFollowupNote || data.note || "";
      const assignedEmail = data.assignedEmail || "";

      let lastUpdatedDisplay = "";
      if (data.lastUpdated && typeof data.lastUpdated.toDate === "function") {
        lastUpdatedDisplay = data.lastUpdated.toDate().toLocaleDateString("en-GB");
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.name || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${data.source || ""}</td>
        <td>${assignedEmail}</td>
        <td>${lastUpdatedDisplay}</td>
        <td><input type="date" value="${nextDate}" id="nd-${doc.id}"></td>
        <td><textarea id="nt-${doc.id}">${followNote}</textarea></td>
        <td><button onclick="updateLead('${doc.id}')">Save</button></td>
      `;
      table.appendChild(tr);
    });

    renderCalendar();
    updateDashboard();
  }, err => {
    console.error("Error loading leads", err);
    alert("Error loading leads: " + err.message);
  });
}

// ==== UPDATE LEAD ====
async function updateLead(id) {
  const nextDate = document.getElementById(`nd-${id}`).value;
  const note = document.getElementById(`nt-${id}`).value;

  try {
    await db.collection("leads").doc(id).update({
      nextFollowupDate: nextDate || "",
      nextFollowupNote: note || "",
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Updated");
  } catch (e) {
    console.error(e);
    alert("Error updating: " + e.message);
  }
}

// ===== DASHBOARD STATS =====
function updateDashboard() {
  const total = leadsCache.length;

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7ISO = in7.toISOString().slice(0, 10);

  let upcoming = 0;
  let overdue = 0;

  leadsCache.forEach(l => {
    const d = l.nextFollowupDate;
    if (!d) return;
    if (d < todayISO) overdue++;
    if (d >= todayISO && d <= in7ISO) upcoming++;
  });

  document.getElementById("dash-total").innerText = total;
  document.getElementById("dash-upcoming").innerText = upcoming;
  document.getElementById("dash-overdue").innerText = overdue;
}

// ===== CALENDAR LOGIC =====
function formatDateISO(y, m, d) {
  const mm = (m + 1).toString().padStart(2, "0");
  const dd = d.toString().padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function renderCalendar() {
  const header = document.getElementById("calendar-month-label");
  const body = document.getElementById("calendar-body");
  if (!header || !body) return;

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  header.innerText = `${monthNames[calMonth]} ${calYear}`;

  body.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  let currentDay = 1;
  for (let row = 0; row < 6; row++) {
    const tr = document.createElement("tr");

    for (let col = 0; col < 7; col++) {
      const td = document.createElement("td");

      if (row === 0 && col < startOffset) {
        td.innerHTML = "&nbsp;";
      } else if (currentDay > daysInMonth) {
        td.innerHTML = "&nbsp;";
      } else {
        const isoDate = formatDateISO(calYear, calMonth, currentDay);
        const count = leadsCache.filter(l => (l.nextFollowupDate || "") === isoDate).length;
        td.innerHTML = `<div>${currentDay}</div>${count > 0 ? "<div>•</div>" : ""}`;
        currentDay++;
      }

      tr.appendChild(td);
    }

    body.appendChild(tr);
    if (currentDay > daysInMonth) break;
  }
}

function prevMonth() {
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
}

function nextMonth() {
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
}
