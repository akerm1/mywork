// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDznYcUtQWRD7QqYBDr1QupUMfVqZnfGEE",
    authDomain: "my-work-82778.firebaseapp.com",
    projectId: "my-work-82778",
    storageBucket: "my-work-82778.firebasestorage.app",
    messagingSenderId: "1070444118182",
    appId: "1:1070444118182:web:bae373255bd124d3a2b467"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variables
let currentBulkClient = null;
let accounts = [];
let clients = [];
let filteredAccounts = [];
let isSearchActive = false;

// Utility Functions
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateForStorage(dateString) {
    if (!dateString) return getTodayFormatted();
    return dateString; // Already in YYYY-MM-DD format
}

function getTodayFormatted() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTomorrowFormatted() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showMessage(message, type = 'success') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.remove();
    }, 4000);
}

// Firebase Functions
async function loadAccounts() {
    try {
        showLoading();
        const snapshot = await db.collection('accounts').get();
        accounts = [];
        
        snapshot.forEach(doc => {
            accounts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Get unique clients
        clients = [...new Set(accounts.map(acc => acc.client))].filter(Boolean);
        
        renderAccounts();
        renderExpiringAccounts();
        hideLoading();
    } catch (error) {
        console.error('Error loading accounts:', error);
        showMessage('Error loading accounts', 'error');
        hideLoading();
    }
}

async function saveAccount(accountData) {
    try {
        const docRef = await db.collection('accounts').add({
            client: accountData.client,
            email: accountData.email,
            date: formatDateForStorage(accountData.date),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return docRef.id;
    } catch (error) {
        console.error('Error saving account:', error);
        throw error;
    }
}

async function updateAccount(id, accountData) {
    try {
        await db.collection('accounts').doc(id).update({
            client: accountData.client,
            email: accountData.email,
            date: formatDateForStorage(accountData.date),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating account:', error);
        throw error;
    }
}

async function deleteAccount(id) {
    try {
        await db.collection('accounts').doc(id).delete();
    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
}

async function bulkSaveAccounts(accountsData) {
    try {
        const batch = db.batch();
        
        accountsData.forEach(accountData => {
            const docRef = db.collection('accounts').doc();
            batch.set(docRef, {
                client: accountData.client,
                email: accountData.email,
                date: formatDateForStorage(accountData.date),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
    } catch (error) {
        console.error('Error bulk saving accounts:', error);
        throw error;
    }
}

// Search Functions
function performSearch() {
    const emailQuery = document.getElementById('emailSearchInput').value.trim().toLowerCase();
    const dateQuery = document.getElementById('dateSearchInput').value;
    const clientQuery = document.getElementById('clientSearchInput').value.trim().toLowerCase();
    
    if (!emailQuery && !dateQuery && !clientQuery) {
        clearSearch();
        return;
    }
    
    filteredAccounts = accounts.filter(account => {
        const emailMatch = !emailQuery || account.email.toLowerCase().includes(emailQuery);
        const dateMatch = !dateQuery || account.date === dateQuery;
        const clientMatch = !clientQuery || account.client.toLowerCase().includes(clientQuery);
        
        return emailMatch && dateMatch && clientMatch;
    });
    
    isSearchActive = true;
    renderSearchResults();
}

function clearSearch() {
    document.getElementById('emailSearchInput').value = '';
    document.getElementById('dateSearchInput').value = '';
    document.getElementById('clientSearchInput').value = '';
    document.getElementById('searchResults').style.display = 'none';
    isSearchActive = false;
    filteredAccounts = [];
}

function renderSearchResults() {
    const resultsContainer = document.getElementById('searchResults');
    const resultsBody = document.getElementById('searchResultsBody');
    const resultCount = document.getElementById('resultCount');
    
    if (filteredAccounts.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="4" class="no-data">No accounts found matching your search criteria.</td></tr>';
        resultCount.textContent = '0 results found';
    } else {
        resultsBody.innerHTML = filteredAccounts.map(account => `
            <tr class="account-row">
                <td>${account.client}</td>
                <td>${account.email}</td>
                <td>${formatDateForDisplay(account.date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-warning btn-small" onclick="editAccount('${account.id}')">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-small" onclick="confirmDeleteAccount('${account.id}')">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        resultCount.textContent = `${filteredAccounts.length} result${filteredAccounts.length !== 1 ? 's' : ''} found`;
    }
    
    resultsContainer.style.display = 'block';
}

// Export Functions
function exportToCSV() {
    const dataToExport = isSearchActive ? filteredAccounts : accounts;
    
    if (dataToExport.length === 0) {
        showMessage('No accounts to export', 'error');
        return;
    }
    
    const headers = ['Client', 'Email', 'Expiration Date'];
    const csvContent = [
        headers.join(','),
        ...dataToExport.map(account => [
            `"${account.client}"`,
            `"${account.email}"`,
            `"${formatDateForDisplay(account.date)}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-accounts-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    const exportType = isSearchActive ? 'filtered' : 'all';
    showMessage(`CSV file with ${exportType} accounts downloaded successfully`);
}

function exportToExcel() {
    const dataToExport = isSearchActive ? filteredAccounts : accounts;
    
    if (dataToExport.length === 0) {
        showMessage('No accounts to export', 'error');
        return;
    }
    
    // Create Excel content in XML format
    const excelContent = `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="Email Accounts">
            <Table>
                <Row>
                    <Cell><Data ss:Type="String">Client</Data></Cell>
                    <Cell><Data ss:Type="String">Email</Data></Cell>
                    <Cell><Data ss:Type="String">Expiration Date</Data></Cell>
                </Row>
                ${dataToExport.map(account => `
                    <Row>
                        <Cell><Data ss:Type="String">${account.client}</Data></Cell>
                        <Cell><Data ss:Type="String">${account.email}</Data></Cell>
                        <Cell><Data ss:Type="String">${formatDateForDisplay(account.date)}</Data></Cell>
                    </Row>
                `).join('')}
            </Table>
        </Worksheet>
    </Workbook>`;
    
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-accounts-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    const exportType = isSearchActive ? 'filtered' : 'all';
    showMessage(`Excel file with ${exportType} accounts downloaded successfully`);
}

function exportToJSON() {
    const dataToExport = isSearchActive ? filteredAccounts : accounts;
    
    if (dataToExport.length === 0) {
        showMessage('No accounts to export', 'error');
        return;
    }
    
    const jsonContent = JSON.stringify(dataToExport.map(account => ({
        client: account.client,
        email: account.email,
        expirationDate: formatDateForDisplay(account.date),
        rawDate: account.date
    })), null, 2);
    
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-accounts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    const exportType = isSearchActive ? 'filtered' : 'all';
    showMessage(`JSON file with ${exportType} accounts downloaded successfully`);
}

// Rendering Functions
function renderAccounts() {
    const container = document.getElementById('clientsContainer');
    container.innerHTML = '';
    
    // Group accounts by client
    const accountsByClient = {};
    accounts.forEach(account => {
        if (!accountsByClient[account.client]) {
            accountsByClient[account.client] = [];
        }
        accountsByClient[account.client].push(account);
    });
    
    // Render each client section
    Object.keys(accountsByClient).sort().forEach(client => {
        const clientSection = createClientSection(client, accountsByClient[client]);
        container.appendChild(clientSection);
    });
    
    if (Object.keys(accountsByClient).length === 0) {
        container.innerHTML = '<div class="no-data">No accounts found. Add your first client to get started!</div>';
    }
}

function createClientSection(clientName, clientAccounts) {
    const section = document.createElement('div');
    section.className = 'client-section';
    section.innerHTML = `
        <div class="client-header">
            <div class="client-name">${clientName}</div>
            <div class="client-actions">
                <button class="btn btn-success btn-small" onclick="addNewAccount('${clientName}')">
                    + Add New Account
                </button>
                <button class="btn btn-primary btn-small" onclick="openBulkUpload('${clientName}')">
                    + Bulk Upload Emails
                </button>
            </div>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Expiration Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="client-${clientName.replace(/\s+/g, '-')}">
                    ${clientAccounts.map(account => createAccountRow(account)).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return section;
}

function createAccountRow(account) {
    return `
        <tr class="account-row" data-id="${account.id}">
            <td class="email-cell">${account.email}</td>
            <td class="date-cell">${formatDateForDisplay(account.date)}</td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="btn btn-warning btn-small" onclick="editAccount('${account.id}')">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="confirmDeleteAccount('${account.id}')">
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderExpiringAccounts() {
    const tomorrow = getTomorrowFormatted();
    const expiringAccounts = accounts.filter(account => account.date === tomorrow);
    
    const tbody = document.getElementById('expiringTableBody');
    const noDataDiv = document.getElementById('noExpiringAccounts');
    
    if (expiringAccounts.length === 0) {
        tbody.innerHTML = '';
        noDataDiv.style.display = 'block';
    } else {
        noDataDiv.style.display = 'none';
        tbody.innerHTML = expiringAccounts.map(account => `
            <tr class="account-row">
                <td>${account.client}</td>
                <td>${account.email}</td>
                <td>${formatDateForDisplay(account.date)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-warning btn-small" onclick="editAccount('${account.id}')">
                            Edit
                        </button>
                        <button class="btn btn-danger btn-small" onclick="confirmDeleteAccount('${account.id}')">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Account Management Functions
function addNewAccount(clientName) {
    const tbody = document.getElementById(`client-${clientName.replace(/\s+/g, '-')}`);
    const newRow = document.createElement('tr');
    newRow.className = 'account-row editing-row';
    newRow.innerHTML = `
        <td>
            <input type="email" class="new-email" placeholder="Enter email" required>
        </td>
        <td>
            <input type="date" class="new-date" value="${getTodayFormatted()}">
        </td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-success btn-small" onclick="saveNewAccount('${clientName}', this)">
                    Save
                </button>
                <button class="btn btn-secondary btn-small" onclick="cancelNewAccount(this)">
                    Cancel
                </button>
            </div>
        </td>
    `;
    
    tbody.appendChild(newRow);
    newRow.querySelector('.new-email').focus();
}

async function saveNewAccount(clientName, button) {
    const row = button.closest('tr');
    const email = row.querySelector('.new-email').value.trim();
    const date = row.querySelector('.new-date').value;
    
    if (!email) {
        showMessage('Please enter an email address', 'error');
        return;
    }
    
    if (!email.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showLoading();
        const accountData = {
            client: clientName,
            email: email,
            date: date || getTodayFormatted()
        };
        
        const id = await saveAccount(accountData);
        accounts.push({ id, ...accountData });
        
        hideLoading();
        showMessage('Account added successfully');
        renderAccounts();
        renderExpiringAccounts();
        
        // Update search results if search is active
        if (isSearchActive) {
            performSearch();
        }
    } catch (error) {
        hideLoading();
        showMessage('Error adding account', 'error');
    }
}

function cancelNewAccount(button) {
    const row = button.closest('tr');
    row.remove();
}

function editAccount(id) {
    const account = accounts.find(acc => acc.id === id);
    if (!account) return;
    
    // Close search results and show main view if editing from search
    if (isSearchActive) {
        document.getElementById('searchResults').style.display = 'none';
        renderAccounts();
    }
    
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;
    
    const emailCell = row.querySelector('.email-cell');
    const dateCell = row.querySelector('.date-cell');
    const actionsCell = row.querySelector('.actions-cell');
    
    // Convert to edit mode
    emailCell.innerHTML = `<input type="email" class="edit-email" value="${account.email}">`;
    dateCell.innerHTML = `<input type="date" class="edit-date" value="${account.date}">`;
    actionsCell.innerHTML = `
        <div class="action-buttons">
            <button class="btn btn-success btn-small" onclick="saveAccountEdit('${id}')">
                Save
            </button>
            <button class="btn btn-secondary btn-small" onclick="cancelAccountEdit('${id}')">
                Cancel
            </button>
        </div>
    `;
    
    row.classList.add('editing-row');
    row.querySelector('.edit-email').focus();
}

async function saveAccountEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const email = row.querySelector('.edit-email').value.trim();
    const date = row.querySelector('.edit-date').value;
    
    if (!email || !email.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showLoading();
        const account = accounts.find(acc => acc.id === id);
        const updatedData = {
            client: account.client,
            email: email,
            date: date || getTodayFormatted()
        };
        
        await updateAccount(id, updatedData);
        
        // Update local data
        Object.assign(account, updatedData);
        
        hideLoading();
        showMessage('Account updated successfully');
        renderAccounts();
        renderExpiringAccounts();
        
        // Update search results if search is active
        if (isSearchActive) {
            performSearch();
        }
    } catch (error) {
        hideLoading();
        showMessage('Error updating account', 'error');
    }
}

function cancelAccountEdit(id) {
    renderAccounts();
    renderExpiringAccounts();
}

function confirmDeleteAccount(id) {
    const account = accounts.find(acc => acc.id === id);
    showConfirmModal(`Are you sure you want to delete ${account.email}?`, () => {
        deleteAccountConfirmed(id);
    });
}

async function deleteAccountConfirmed(id) {
    try {
        showLoading();
        await deleteAccount(id);
        
        // Remove from local data
        accounts = accounts.filter(acc => acc.id !== id);
        
        hideLoading();
        showMessage('Account deleted successfully');
        renderAccounts();
        renderExpiringAccounts();
        
        // Update search results if search is active
        if (isSearchActive) {
            performSearch();
        }
    } catch (error) {
        hideLoading();
        showMessage('Error deleting account', 'error');
    }
}

// Bulk Upload Functions
function openBulkUpload(clientName) {
    currentBulkClient = clientName;
    const modal = document.getElementById('bulkUploadModal');
    const input = document.getElementById('bulkEmailInput');
    
    input.value = '';
    modal.style.display = 'block';
    input.focus();
}

async function processBulkUpload() {
    const input = document.getElementById('bulkEmailInput').value.trim();
    
    if (!input) {
        showMessage('Please enter some emails', 'error');
        return;
    }
    
    const lines = input.split('\n').filter(line => line.trim());
    const accountsToAdd = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        let email, date;
        
        if (trimmedLine.includes(',')) {
            const parts = trimmedLine.split(',');
            email = parts[0].trim();
            date = parts[1].trim();
        } else {
            email = trimmedLine;
            date = getTodayFormatted();
        }
        
        // Validate email
        if (!email.includes('@')) {
            errors.push(`Line ${index + 1}: Invalid email format`);
            return;
        }
        
        // Validate date if provided
        if (date && date !== getTodayFormatted()) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                errors.push(`Line ${index + 1}: Invalid date format (use YYYY-MM-DD)`);
                return;
            }
        }
        
        accountsToAdd.push({
            client: currentBulkClient,
            email: email,
            date: date || getTodayFormatted()
        });
    });
    
    if (errors.length > 0) {
        showMessage(errors.join('\n'), 'error');
        return;
    }
    
    if (accountsToAdd.length === 0) {
        showMessage('No valid emails found', 'error');
        return;
    }
    
    try {
        showLoading();
        await bulkSaveAccounts(accountsToAdd);
        
        // Add to local data
        accountsToAdd.forEach(accountData => {
            accounts.push({
                id: Date.now() + Math.random(), // Temporary ID
                ...accountData
            });
        });
        
        hideLoading();
        closeBulkUploadModal();
        showMessage(`Successfully added ${accountsToAdd.length} accounts`);
        
        // Reload to get proper IDs from Firebase
        loadAccounts();
    } catch (error) {
        hideLoading();
        showMessage('Error uploading accounts', 'error');
    }
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').style.display = 'none';
    currentBulkClient = null;
}

// Client Management Functions
function showAddClientForm() {
    document.getElementById('addClientBtn').style.display = 'none';
    document.getElementById('newClientForm').style.display = 'flex';
    document.getElementById('newClientName').focus();
}

function hideAddClientForm() {
    document.getElementById('addClientBtn').style.display = 'inline-block';
    document.getElementById('newClientForm').style.display = 'none';
    document.getElementById('newClientName').value = '';
}

async function saveNewClient() {
    const clientName = document.getElementById('newClientName').value.trim();
    
    if (!clientName) {
        showMessage('Please enter a client name', 'error');
        return;
    }
    
    if (clients.includes(clientName)) {
        showMessage('Client already exists', 'error');
        return;
    }
    
    // Add a placeholder account for the new client
    try {
        showLoading();
        const placeholderAccount = {
            client: clientName,
            email: 'example@email.com',
            date: getTodayFormatted()
        };
        
        const id = await saveAccount(placeholderAccount);
        accounts.push({ id, ...placeholderAccount });
        clients.push(clientName);
        
        hideLoading();
        hideAddClientForm();
        showMessage(`Client "${clientName}" added successfully`);
        renderAccounts();
        
        // Automatically start editing the placeholder account
        setTimeout(() => {
            editAccount(id);
        }, 100);
    } catch (error) {
        hideLoading();
        showMessage('Error adding client', 'error');
    }
}

// Modal Functions
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    
    messageEl.textContent = message;
    modal.style.display = 'block';
    
    // Set up event handlers
    document.getElementById('confirmYes').onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    
    document.getElementById('confirmNo').onclick = () => {
        modal.style.display = 'none';
    };
}

// Real-time Updates (Optional Enhancement)
function setupRealTimeUpdates() {
    db.collection('accounts').onSnapshot((snapshot) => {
        const updatedAccounts = [];
        snapshot.forEach(doc => {
            updatedAccounts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        accounts = updatedAccounts;
        clients = [...new Set(accounts.map(acc => acc.client))].filter(Boolean);
        
        renderAccounts();
        renderExpiringAccounts();
        
        // Update search results if search is active
        if (isSearchActive) {
            performSearch();
        }
    }, (error) => {
        console.error('Error in real-time updates:', error);
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadAccounts();
    
    // Set up real-time updates (optional)
    // setupRealTimeUpdates();
    
    // Add Client button
    document.getElementById('addClientBtn').addEventListener('click', showAddClientForm);
    document.getElementById('saveClientBtn').addEventListener('click', saveNewClient);
    document.getElementById('cancelClientBtn').addEventListener('click', hideAddClientForm);
    
    // New client form - Enter key
    document.getElementById('newClientName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveNewClient();
        }
    });
    
    // Search functionality
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    
    // Search inputs - Enter key
    ['emailSearchInput', 'dateSearchInput', 'clientSearchInput'].forEach(inputId => {
        document.getElementById(inputId).addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    });
    
    // Export buttons
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportJSONBtn').addEventListener('click', exportToJSON);
    
    // Bulk upload modal
    document.getElementById('processBulkUpload').addEventListener('click', processBulkUpload);
    document.getElementById('cancelBulkUpload').addEventListener('click', closeBulkUploadModal);
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Click outside modal to close
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
        
        // Ctrl+N to add new client
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            showAddClientForm();
        }
        
        // Ctrl+F to focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            document.getElementById('emailSearchInput').focus();
        }
        
        // Ctrl+E to export CSV
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportToCSV();
        }
    });
});

// Error Handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showMessage('An unexpected error occurred', 'error');
});

// Service Worker for Offline Support (Optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful');
        }, function(err) {
            console.log('ServiceWorker registration failed');
        });
    });
}