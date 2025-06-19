const $ = (id) => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = section.id === id ? 'block' : 'none';
  });
  if (id === 'branches') loadBranches();
  if (id === 'computers') {
    loadBranchOptions();
    loadComputers();
  }
  if (id === 'recalls') loadRecalls();
}

// --- סניפים ---
async function loadBranches() {
  const list = $('branchList');
  list.innerHTML = '';
  const branches = await fetchJson('/api/branches');
  branches.forEach(branch => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${branch.name}</strong> (קוד ${branch.code})<br>
      כתובת: ${branch.address || '-'}<br>
      טלפון: ${branch.phone || '-'}, מנהל: ${branch.manager_phone || '-'}`;

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ ערוך';
    editBtn.onclick = () => openEditBranchModal(branch);
    li.appendChild(document.createElement('br'));
    li.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️ מחק';
    delBtn.onclick = () => deleteBranch(branch.id);
    li.appendChild(delBtn);

    list.appendChild(li);
  });
}

function openEditBranchModal(branch) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>עריכת סניף</h3>
    <label>שם: <input id="editName" value="${branch.name}"></label><br>
    <label>כתובת: <input id="editAddress" value="${branch.address || ''}"></label><br>
    <label>טלפון: <input id="editPhone" value="${branch.phone || ''}"></label><br>
    <label>טלפון מנהל: <input id="editManagerPhone" value="${branch.manager_phone || ''}"></label><br>
    <label>קוד סניף: <input id="editCode" value="${branch.code}"></label><br>
    <button onclick="saveBranchChanges(${branch.id})">💾 שמור</button>
    <button onclick="this.parentNode.remove()">❌ ביטול</button>
  `;
  document.body.appendChild(modal);
}

async function saveBranchChanges(id) {
  const data = {
    name: $('editName').value,
    address: $('editAddress').value,
    phone: $('editPhone').value,
    manager_phone: $('editManagerPhone').value,
    code: $('editCode').value,
  };
  await fetch(`/api/branches/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  document.querySelector('.modal')?.remove();
  loadBranches();
  loadComputers();
}

async function addBranch(e) {
  e.preventDefault();
  const data = {
    name: $('branchName').value,
    address: $('branchAddress').value,
    phone: $('branchPhone').value,
    manager_phone: $('branchManagerPhone').value
  };
  await fetch('/api/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  e.target.reset();
  loadBranches();
}

async function deleteBranch(id) {
  const computers = await fetchJson('/api/computers');
  const hasComputers = computers.some(c => c.branch_id === id);
  if (hasComputers) return alert('❌ לא ניתן למחוק סניף שיש בו מחשבים!');
  if (confirm('האם אתה בטוח שברצונך למחוק את הסניף?')) {
    await fetch(`/api/branches/${id}`, { method: 'DELETE' });
    loadBranches();
    loadComputers();
  }
}

// --- מחשבים ---
async function loadBranchOptions() {
  const branches = await fetchJson('/api/branches');
  const select = $('computerBranch');
  select.innerHTML = '';
  branches.forEach(branch => {
    const option = document.createElement('option');
    option.value = branch.id;
    option.textContent = `${branch.name} (קוד ${branch.code})`;
    select.appendChild(option);
  });
}

async function loadComputers() {
  const list = $('computerList');
  list.innerHTML = '';
  const computers = await fetchJson('/api/computers');
  const branches = await fetchJson('/api/branches');
  const grouped = {};
  computers.forEach(c => {
    const key = c.branch_name || 'ללא סניף';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });
  for (const branchName in grouped) {
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'branch-group';
    const title = document.createElement('h3');
    title.textContent = branchName;
    groupWrapper.appendChild(title);

    const ul = document.createElement('ul');
    grouped[branchName].forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${c.model}</strong> (מזהה ${c.code})<br>`;
      const recallBtn = document.createElement('button');
      recallBtn.textContent = '📦 העבר לריקול';
      recallBtn.onclick = () => recallComputer(c.id);
      li.appendChild(recallBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️ מחק';
      deleteBtn.onclick = () => deleteComputer(c.id);
      li.appendChild(deleteBtn);

      const changeBtn = document.createElement('button');
      changeBtn.textContent = '🔄 שנה סניף';
      changeBtn.onclick = () => {
        const select = document.createElement('select');
        branches.forEach(b => {
          const option = document.createElement('option');
          option.value = b.id;
          option.textContent = `${b.name} (קוד ${b.code})`;
          if (b.id === c.branch_id) option.selected = true;
          select.appendChild(option);
        });
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 אישור';
        saveBtn.onclick = async () => {
          await fetch(`/api/computers/${c.id}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch_id: select.value })
          });
          loadComputers();
        };
        li.appendChild(document.createElement('br'));
        li.appendChild(select);
        li.appendChild(saveBtn);
      };
      li.appendChild(changeBtn);
      ul.appendChild(li);
    });
    groupWrapper.appendChild(ul);
    list.appendChild(groupWrapper);
  }
}

async function addComputer(e) {
  e.preventDefault();
  const model = $('computerModel').value;
  const branchId = $('computerBranch').value;
  await fetch('/api/computers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, branch_id: branchId })
  });
  e.target.reset();
  loadComputers();
}

async function deleteComputer(id) {
  if (confirm('האם למחוק מחשב זה?')) {
    await fetch(`/api/computers/${id}`, { method: 'DELETE' });
    loadComputers();
  }
}

async function recallComputer(id) {
  await fetch(`/api/computers/${id}/recall`, { method: 'POST' });
  loadComputers();
  loadRecalls();
}

// --- ריקול ---
async function loadRecalls() {
  const list = $('recallList');
  list.innerHTML = '';
  const recalls = await fetchJson('/api/recalls');
  recalls.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${c.model}</strong> (מזהה ${c.code})`;
    list.appendChild(li);
  });
}

// כלי עזר
async function fetchJson(url) {
  const res = await fetch(url);
  return await res.json();
}
