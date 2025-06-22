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

// --- פונקציית סינון אוניברסלית ---
function createSearchInput(containerId, inputId, onInput) {
  if (document.getElementById(inputId)) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '🔍 סינון...';
  input.id = inputId;
  input.className = 'search-box';
  input.oninput = onInput;
  const container = document.getElementById(containerId);
  container.parentNode.insertBefore(input, container);
}

function filterList(container, query) {
  const text = query.toLowerCase();
  container.querySelectorAll('li').forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(text) ? '' : 'none';
  });
}

// --- סניפים ---
async function loadBranches() {
  const list = $('branchList');
  list.innerHTML = '';
  createSearchInput('branchList', 'branchSearchInput', e => filterList(list, e.target.value));
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
  createSearchInput('computerList', 'computerSearchInput', e => filterList(list, e.target.value));
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

    const group = grouped[branchName];

    const recallBtn = document.createElement('button');
    recallBtn.textContent = '📦 הוצא מחשבים לריקול';
    recallBtn.onclick = () => openGroupRecallModal(group);
    groupWrapper.appendChild(recallBtn);

    const transferBtn = document.createElement('button');
    transferBtn.textContent = '🔄 העבר סניף';
    transferBtn.onclick = () => openGroupTransferModal(group);
    groupWrapper.appendChild(transferBtn);

    const ul = document.createElement('ul');
    group.forEach(c => {
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
  createSearchInput('recallList', 'recallSearchInput', e => filterList(list, e.target.value));

  const recalls = await fetchJson('/api/recalls');
  const branches = await fetchJson('/api/branches');

  const headerBtn = document.createElement('button');
  headerBtn.textContent = '↩️ החזר מחשבים מריקול';
  headerBtn.onclick = () => openGroupReturnModal(recalls);

  const headerDiv = document.createElement('div');
  headerDiv.style.marginBottom = '15px';
  headerDiv.appendChild(headerBtn);
  list.appendChild(headerDiv);

  recalls.forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${c.model}</strong> (מזהה ${c.code})<br>`;

    const select = document.createElement('select');
    branches.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = `${b.name} (קוד ${b.code})`;
      select.appendChild(option);
    });

    const returnBtn = document.createElement('button');
    returnBtn.textContent = '↩️ החזר';
    returnBtn.onclick = async () => {
      await fetch(`/api/computers/${c.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: select.value })
      });
      loadComputers();
      loadRecalls();
    };

    li.appendChild(select);
    li.appendChild(returnBtn);
    list.appendChild(li);
  });
}
// --- חלוניות קבוצתיות ---
function openGroupRecallModal(computers) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>בחר מחשבים להוצאת ריקול</h3>
    <input type="text" id="recallFilter" placeholder="🔍 סינון..."><br>
    <ul id="recallListModal">${computers.map(c =>
      `<li><label><input type="checkbox" value="${c.id}"> ${c.model} (מזהה ${c.code})</label></li>`
    ).join('')}</ul>
    <button id="confirmRecall">📦 הוצא</button>
    <button onclick="this.parentNode.remove()">❌ ביטול</button>
  `;
  document.body.appendChild(modal);
  const filterInput = document.getElementById('recallFilter');
  const list = document.getElementById('recallListModal');
  filterInput.oninput = () => filterList(list, filterInput.value);

  document.getElementById('confirmRecall').onclick = async () => {
    const selectedIds = Array.from(list.querySelectorAll('input:checked')).map(cb => cb.value);
    for (const id of selectedIds) {
      await fetch(`/api/computers/${id}/recall`, { method: 'POST' });
    }
    modal.remove();
    loadComputers();
    loadRecalls();
  };
}

function openGroupTransferModal(computers) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>העבר מחשבים לסניף אחר</h3>
    <input type="text" id="transferFilter" placeholder="🔍 סינון..."><br>
    <ul id="transferList">${computers.map(c =>
      `<li><label><input type="checkbox" value="${c.id}"> ${c.model} (מזהה ${c.code})</label></li>`
    ).join('')}</ul>
    <label>בחר סניף יעד:</label>
    <select id="targetBranch"></select><br><br>
    <button id="confirmTransfer">🔄 בצע העברה</button>
    <button onclick="this.parentNode.remove()">❌ ביטול</button>
  `;
  document.body.appendChild(modal);
  const filterInput = document.getElementById('transferFilter');
  const list = document.getElementById('transferList');
  filterInput.oninput = () => filterList(list, filterInput.value);

  fetchJson('/api/branches').then(branches => {
    const select = document.getElementById('targetBranch');
    branches.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = `${b.name} (קוד ${b.code})`;
      select.appendChild(option);
    });
  });

  document.getElementById('confirmTransfer').onclick = async () => {
    const selectedIds = Array.from(list.querySelectorAll('input:checked')).map(cb => cb.value);
    const branchId = document.getElementById('targetBranch').value;
    for (const id of selectedIds) {
      await fetch(`/api/computers/${id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId })
      });
    }
    modal.remove();
    loadComputers();
  };
}

function openGroupReturnModal(computers) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h3>החזר מחשבים מריקול</h3>
    <input type="text" id="returnFilter" placeholder="🔍 סינון..."><br>
    <ul id="returnList">${computers.map(c =>
      `<li><label><input type="checkbox" value="${c.id}"> ${c.model} (מזהה ${c.code})</label></li>`
    ).join('')}</ul>
    <label>בחר סניף יעד:</label>
    <select id="returnTargetBranch"></select><br><br>
    <button id="confirmReturn">↩️ החזר נבחרים</button>
    <button onclick="this.parentNode.remove()">❌ ביטול</button>
  `;
  document.body.appendChild(modal);
  const filterInput = document.getElementById('returnFilter');
  const list = document.getElementById('returnList');
  filterInput.oninput = () => filterList(list, filterInput.value);

  fetchJson('/api/branches').then(branches => {
    const select = document.getElementById('returnTargetBranch');
    branches.forEach(b => {
      const option = document.createElement('option');
      option.value = b.id;
      option.textContent = `${b.name} (קוד ${b.code})`;
      select.appendChild(option);
    });
  });

  document.getElementById('confirmReturn').onclick = async () => {
    const selectedIds = Array.from(list.querySelectorAll('input:checked')).map(cb => cb.value);
    const branchId = document.getElementById('returnTargetBranch').value;
    for (const id of selectedIds) {
      await fetch(`/api/computers/${id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: branchId })
      });
    }
    modal.remove();
    loadRecalls();
    loadComputers();
  };
}

// --- כלי עזר ---
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`שגיאה בפניה אל ${url}`);
  return await res.json();
}