const axios = require("axios");

// Config
const CONFIG = {
    // F12 and see any api call in Network tab to find out the access token
    ACCESS_TOKEN: "dummy_data",
    /** 
     * https://mail.tutanota.com/rest/sys/sessionservice see this api call in Network tab
    "1223": [
        "user_id will be here"
    ] **/
    USER_ID: "dummy_data",
    BASE_URL: "https://mail.tutanota.com"
};

const api = axios.create({
    baseURL: CONFIG.BASE_URL,
    headers: {
        accessToken: CONFIG.ACCESS_TOKEN,
        "Content-Type": "application/json",
    }
});

function logInfo(label, value) {
    console.log(`📌 ${label}:`, value);
}

function logSuccess(msg) {
    console.log(`✅ ${msg}`);
}

function logError(msg) {
    console.error(`❌ ${msg}`);
}

async function getUser() {
    const res = await api.get(`/rest/sys/user/${CONFIG.USER_ID}`);
    const mailMembership = res.data.memberships?.find(m => m.groupType === "5");
    if (!mailMembership) throw new Error("Mail membership not found");
    logSuccess("Mail membership located");
    logInfo("Mail Group", mailMembership.group);
    return mailMembership;
}

async function getMailbox(groupId) {
    const res = await api.get(`/rest/tutanota/mailboxgrouproot/${groupId}`);
    const mailboxId = res.data.mailbox;
    logSuccess("Mailbox group root fetched");
    logInfo("Mailbox ID", mailboxId);
    return mailboxId;
}

async function getFolders(mailboxId) {
    const res = await api.get(`/rest/tutanota/mailbox/${mailboxId}`);
    const folderId = res.data.folders?.folders;
    logSuccess("Mailbox fetched");
    logInfo("Folder Set ID", folderId);
    return folderId;
}

async function getFolderList(folderSetId) {
    const res = await api.get(`/rest/tutanota/mailfolder/${folderSetId}`, {
        params: { start: '', count: 1000, reverse: false }
    });
    const folders = res.data;
    logSuccess(`Folder list fetched (${folders.length})`);
    return folders;
}

async function getInboxFolder(folders) {
    const inbox = folders.find(f => f.folderType === "1");
    if (!inbox) throw new Error("Inbox folder not found");
    logSuccess("Inbox folder identified");
    logInfo("Entries List ID", inbox.entries);
    return inbox.entries;
}

async function getMailSetEntries(entryId) {
    const res = await api.get(`/rest/tutanota/mailsetentry/${entryId}`, {
        params: {
            start: '_'.repeat(256),
            count: 100,
            reverse: true
        }
    });
    const entries = res.data;
    logSuccess(`Mail set entries fetched (${entries.length})`);
    return entries;
}

async function getMails(firstMailId, mailIds) {
    const res = await api.get(`/rest/tutanota/mail/${firstMailId}`, {
        params: { ids: mailIds.join(',') }
    });
    const mails = res.data;
    logSuccess(`Mails fetched (${mails.length})`);
    return mails;
}

async function main() {
    try {
        console.log("📬 Starting Tutanota Mail Workflow\n" + "-".repeat(40));

        const membership = await getUser();
        const mailboxId = await getMailbox(membership.group);
        const folderSetId = await getFolders(mailboxId);
        const folders = await getFolderList(folderSetId);
        const entryId = await getInboxFolder(folders);
        const entries = await getMailSetEntries(entryId);

        if (!entries.length) {
            console.warn("⚠️ Inbox has no mail set entries.");
            return;
        }

        const mailIds = entries.map(e => e.mail[1]);
        const firstMailKey = entries[0].mail[0];
        const mails = await getMails(firstMailKey, mailIds);

        if (!mails.length) {
            console.warn("⚠️ No mail content available.");
            return;
        }

        console.log("\n📨 First 5 Mails Summary:");
        for (const [i, mail] of mails.slice(0, 5).entries()) {
            console.log(`\n📧 Mail [${i + 1}]`);
            logInfo("Sender", mail.sender.address);
            logInfo("To", mail.firstRecipient.address);
            logInfo("Subject (Encrypted)", mail.subject);
            logInfo("Received", new Date(parseInt(mail.receivedDate)).toLocaleString());
            logInfo("Unread", mail.unread === "1" ? "Yes" : "No");
        }

        console.log("\n✅ Mail sync complete.\n" + "-".repeat(40));
    } catch (err) {
        logError(err.message);
        if (err.response) {
            console.error("🔻 Response:", err.response.status, err.response.data);
        }
    }
}

main();
