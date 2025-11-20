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
  auth.signOut();
}

// ==== AUTH STATE LISTENER ====
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("login-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";
    loadLeads();
  } else {
    currentUser = null;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("app-section").style.display = "none";
    document.getElementById("lead-table").innerHTML = "";
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
    await db.collection("leads").add({
      name,
      phone,
      source,
      nextDate,
      note,
      assignedTo: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

// ==== LOAD LEADS FOR CURRENT USER ====
function loadLeads() {
  if (!currentUser) return;

  const ref = db.collection("leads")
                .where("assignedTo", "==", currentUser.uid)
                .orderBy("createdAt", "desc");

  ref.onSnapshot(snapshot => {
    const table = document.getElementById("lead-table");
    table.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const tr = document.createElement("tr");
      const safeDate = data.nextDate || "";

      tr.innerHTML = `
        <td>${data.name || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${data.source || ""}</td>
        <td><input type="date" value="${safeDate}" id="nd-${doc.id}"></td>
        <td><textarea id="nt-${doc.id}">${data.note || ""}</textarea></td>
        <td><button onclick="updateLead('${doc.id}')">Save</button></td>
      `;

      table.appendChild(tr);
    });
  }, err => {
    console.error("Error loading leads", err);
  });
}

// ==== UPDATE LEAD (next date + note) ====
async function updateLead(id) {
  const nextDate = document.getElementById(`nd-${id}`).value;
  const note = document.getElementById(`nt-${id}`).value;

  try {
    await db.collection("leads").doc(id).update({
      nextDate,
      note
    });
    alert("Updated");
  } catch (e) {
    console.error(e);
    alert("Error updating: " + e.message);
  }
}

