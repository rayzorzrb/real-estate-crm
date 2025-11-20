// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyBu43KmFYNmBQfJgbz4Zq226dqaHO5J-eg",
  authDomain: "real-estate-crm-96705.firebaseapp.com",
  projectId: "real-estate-crm-96705",
  storageBucket: "real-estate-crm-96705.firebasestorage.app",
  messagingSenderId: "123357799744",
  appId: "1:123357799744:web:7340f6b436b483c9c786a5"
};

// ===== INIT FIREBASE =====
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isAdmin = false;

// ===== LOGIN =====
function login() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(res => {})
    .catch(err => {
      document.getElementById("login-error").innerText = err.message;
    });
}

// ===== LOGOUT =====
function logout() {
  auth.signOut();
}

// ===== AUTH STATE LISTENER =====
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;

    // check admin role
    const doc = await db.collection("users").doc(user.uid).get();
    isAdmin = doc.exists && doc.data().role === "admin";

    document.getElementById("login-section").style.display = "none";
    document.getElementById("app-section").style.display = "block";

    if (isAdmin) {
      document.getElementById("register-section").style.display = "block";
    }

    loadLeads();
  } else {
    currentUser = null;
    isAdmin = false;
    document.getElementById("login-section").style.display = "block";
    document.getElementById("app-section").style.display = "none";
    document.getElementById("register-section").style.display = "none";
  }
});

// ===== ADMIN CREATE USER =====
async function registerUser() {
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  if (!isAdmin) return alert("Only admin can create users");

  const tempUser = await auth.createUserWithEmailAndPassword(email, password);
  const uid = tempUser.user.uid;

  await db.collection("users").doc(uid).set({
    role: "agent",
    email: email
  });

  document.getElementById("register-msg").innerText = "User created!";
}

// ===== ADD LEAD =====
async function addLead() {
  const name = document.getElementById("lead-name").value;
  const phone = document.getElementById("lead-phone").value;
  const source = document.getElementById("lead-source").value;
  const nextDate = document.getElementById("lead-nextdate").value;
  const note = document.getElementById("lead-note").value;

  await db.collection("leads").add({
    name,
    phone,
    source,
    nextDate,
    note,
    assignedTo: currentUser.uid,
  });

  document.getElementById("lead-msg").innerText = "Lead added.";
  loadLeads();
}

// ===== LOAD LEADS =====
function loadLeads() {
  let ref = db.collection("leads");

  if (!isAdmin) {
    ref = ref.where("assignedTo", "==", currentUser.uid);
  }

  ref.onSnapshot(snapshot => {
    const table = document.getElementById("lead-table");
    table.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${data.name}</td>
        <td>${data.phone}</td>
        <td>${data.source}</td>
        <td><input type="date" value="${data.nextDate || ""}" id="nd-${doc.id}"></td>
        <td><textarea id="nt-${doc.id}">${data.note || ""}</textarea></td>
        <td><button onclick="updateLead('${doc.id}')">Save</button></td>
      `;

      table.appendChild(tr);
    });
  });
}

// ===== UPDATE LEAD =====
async function updateLead(id) {
  const nextDate = document.getElementById(`nd-${id}`).value;
  const note = document.getElementById(`nt-${id}`).value;

  await db.collection("leads").doc(id).update({
    nextDate,
    note
  });

  alert("Updated!");
}
