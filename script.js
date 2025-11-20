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

    // check if this user is admin (role from users collection)
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      isAdmin = userDoc.exists && userDoc.data().role === "admin";
    } catch (e) {
      console.error("Error reading user role", e);
      isAdmin = false;
    }

    document.getElementById("login-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";
    loadLeads();
  } else {
    currentUser = null;
    isAdmin = false;

    if (leadsUnsubscribe) {
      leadsUnsubscribe();
      leadsUnsubscribe = null;
    }

    document.getElementById("login-section").style.display = "block";
    document.getElementById("app-section").style.display = "none";
    document.getElementById("lead-table").innerHTML = "";
  }
});

// ==== ADD LEAD ====
// createdAt + lastUpdated auto = now
// nextFollowupDate + nextFollowupNote from form
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

    // clear form
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

// ==== LOAD LEADS ====
// admin -> all leads
// agent -> only own leads
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

    snapshot.forEach(doc => {
      const data = doc.data();

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
  }, err => {
    console.error("Error loading leads", err);
    alert("Error loading leads: " + err.message);
  });
}

// ==== UPDATE LEAD ====
// updates next follow-up date + note and bumps lastUpdated
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
