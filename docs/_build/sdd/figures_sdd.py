# -*- coding: utf-8 -*-
"""Specs and generation of the SDD figures: architecture, class diagrams, ER diagrams, sequence
diagrams, and the interface screens. Run: python figures_sdd.py"""
import subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "lib"))
import diagrams as D

FIG = HERE / "fig"; FIG.mkdir(exist_ok=True)
SCREENS = HERE.parent.parent / "presentation" / "prototype-screens"

# ------------------------------------------------------------------ class diagrams
CLASS = {
 "cd-auth": {"classes": [
    {"id": "login", "name": "LoginScreen", "stereo": "screen", "x": 20, "y": 20, "attrs": ["email: string", "password: string", "error: string"], "methods": ["handleLogin()"]},
    {"id": "nav", "name": "RootNavigator", "stereo": "screen", "x": 20, "y": 300, "attrs": [], "methods": ["render(): screen by role"]},
    {"id": "auth", "name": "AuthContext", "stereo": "module", "x": 420, "y": 20, "attrs": ["session: Session", "profile: UserProfile", "memberAccount: MemberAccount", "loading: boolean"],
     "methods": ["signIn(email, password)", "signInWithEmailLink(email)", "signOut()", "refreshProfile()", "loadProfile(userId)"]},
    {"id": "prof", "name": "UserProfile", "stereo": "type", "x": 760, "y": 300, "attrs": ["id: uuid", "email: string", "full_name: string", "role: 'staff' | 'owner'", "is_active: boolean", "created_at: timestamp"], "show_methods": False},
    {"id": "sb", "name": "Supabase Auth", "stereo": "external", "x": 790, "y": 20, "attrs": [], "methods": ["signInWithPassword()", "signInWithOtp(email)", "signOut()", "onAuthStateChange()"]},
    {"id": "st", "name": "StaffTabs", "stereo": "screen", "x": 20, "y": 560, "attrs": ["Scan, History"], "show_methods": False},
    {"id": "ot", "name": "OwnerTabs", "stereo": "screen", "x": 215, "y": 560, "attrs": ["Dashboard, Scan,", "History, Staff,", "Settings"], "show_methods": False},
    {"id": "mt", "name": "MemberTabs", "stereo": "screen", "x": 420, "y": 560, "attrs": ["Home, Payments, Rates"], "show_methods": False},
 ], "edges": [
    {"from": "login", "to": "auth", "kind": "uses", "label": "signIn()"},
    {"from": "nav", "to": "auth", "kind": "uses", "label": "reads session, profile"},
    {"from": "auth", "to": "sb", "kind": "uses"},
    {"from": "auth", "to": "prof", "kind": "comp", "m1": "1", "m2": "0..1"},
    {"from": "nav", "to": "login", "kind": "nav", "label": "no session"},
    {"from": "nav", "to": "st", "kind": "nav", "label": "staff", "ax": 0.3, "bx": 0.5},
    {"from": "nav", "to": "ot", "kind": "nav", "label": "owner", "ax": 0.85, "bx": 0.5},
    {"from": "nav", "to": "mt", "kind": "nav", "label": "member", "ax": 0.97, "bx": 0.4},
 ]},
 "cd-member": {"classes": [
    {"id": "ml", "name": "MemberLoginScreen", "stereo": "screen", "x": 20, "y": 20, "attrs": ["email: string", "linkSent: boolean"], "methods": ["requestLink()"]},
    {"id": "home", "name": "MemberHomeScreen", "stereo": "screen", "x": 20, "y": 200, "attrs": ["account: MemberAccount", "daysLeft: number"], "methods": ["load()"]},
    {"id": "pay", "name": "MemberPaymentsScreen", "stereo": "screen", "x": 20, "y": 380, "attrs": ["payments: MemberPayment[]", "yearTotal: number"], "methods": ["openReceipt(payment)"]},
    {"id": "rcpt", "name": "ReceiptScreen", "stereo": "screen", "x": 20, "y": 570, "attrs": ["payment: MemberPayment"], "methods": ["saveAsPdf()", "share()"]},
    {"id": "rates", "name": "MemberRatesScreen", "stereo": "screen", "x": 20, "y": 750, "attrs": ["rates: Rate[]", "announcements: Announcement[]"], "methods": ["load()"]},
    {"id": "auth", "name": "AuthContext", "stereo": "module", "x": 390, "y": 20, "attrs": [], "methods": ["signInWithEmailLink(email)", "loadMemberAccount(userId)"]},
    {"id": "ms", "name": "MemberService", "stereo": "module", "x": 390, "y": 300, "attrs": [], "methods": ["fetchMyAccount(): MemberAccount", "fetchMyPayments(): MemberPayment[]", "fetchRates(): Rate[]", "fetchAnnouncements()"]},
    {"id": "ns", "name": "NotificationService", "stereo": "module", "x": 390, "y": 610, "attrs": [], "methods": ["requestPermission()", "registerPushToken()", "onReminderTapped()"]},
    {"id": "sb", "name": "Supabase", "stereo": "external", "x": 760, "y": 20, "attrs": [], "methods": ["auth.signInWithOtp()", "select own member_accounts", "select own member_payments", "select rates, announcements", "update own push_token"]},
    {"id": "en", "name": "Expo Notifications", "stereo": "external", "x": 760, "y": 610, "attrs": [], "methods": ["getExpoPushTokenAsync()", "addResponseListener()"]},
 ], "edges": [
    {"from": "ml", "to": "auth", "kind": "uses", "label": "requestLink()"},
    {"from": "auth", "to": "sb", "kind": "uses"},
    {"from": "home", "to": "ms", "kind": "uses"},
    {"from": "pay", "to": "ms", "kind": "uses"},
    {"from": "rates", "to": "ms", "kind": "uses"},
    {"from": "pay", "to": "rcpt", "kind": "nav", "label": "opens"},
    {"from": "ms", "to": "sb", "kind": "uses", "label": "own rows (RLS)"},
    {"from": "ns", "to": "en", "kind": "uses"},
    {"from": "ns", "to": "sb", "kind": "uses", "label": "save push_token", "a": ("top", 0.85), "b": ("bottom", 0.3), "via": [("v", 560), ("h", "b"), ("v", "b")]},
 ]},
 "cd-access": {"classes": [
    {"id": "mv", "name": "Members and Rates Views", "stereo": "screen", "x": 20, "y": 20, "attrs": ["Send Invite Link", "Post Announcement"], "show_methods": False},
    {"id": "api", "name": "Member Access API", "stereo": "module", "x": 330, "y": 20, "attrs": [], "methods": ["POST /api/members/:id/invite", "GET /api/announcements", "POST /api/announcements", "DELETE /api/announcements/:id"]},
    {"id": "sync", "name": "MemberSync", "stereo": "module", "x": 330, "y": 300, "attrs": ["interval: 5 minutes"], "methods": ["queueChange(entity, id, action)", "publishPending()", "publishMember(id)", "publishPayment(id)", "publishRates()"]},
    {"id": "box", "name": "SyncOutboxItem", "stereo": "table", "x": 20, "y": 330, "attrs": ["entity: text", "record_id: text", "action: text", "queued_at: datetime", "attempts: integer"], "show_methods": False},
    {"id": "fn", "name": "member-access", "stereo": "external", "x": 720, "y": 20, "attrs": ["Edge Function"], "methods": ["checks the caller is an owner", "invite(member account)", "remove(member account)"]},
    {"id": "db", "name": "Supabase Database", "stereo": "external", "x": 720, "y": 300, "attrs": [], "methods": ["member_accounts", "member_payments", "rates", "announcements"]},
    {"id": "rem", "name": "send-reminders", "stereo": "external", "x": 720, "y": 560, "attrs": ["Edge Function, daily at 8:00 AM"], "methods": ["finds plans expiring in 7, 3, 1 days", "sends one reminder per member"]},
    {"id": "push", "name": "Expo Push Service", "stereo": "external", "x": 720, "y": 800, "attrs": [], "methods": ["sendPushNotifications()"]},
 ], "edges": [
    {"from": "mv", "to": "api", "kind": "uses", "label": "HTTP + JWT"},
    {"from": "api", "to": "fn", "kind": "uses", "label": "invite, remove"},
    {"from": "api", "to": "sync", "kind": "uses", "label": "queueChange()"},
    {"from": "api", "to": "db", "kind": "uses", "label": "announcements"},
    {"from": "sync", "to": "box", "kind": "comp", "m1": "1", "m2": "*"},
    {"from": "sync", "to": "db", "kind": "uses", "label": "upsert, delete"},
    {"from": "fn", "to": "db", "kind": "uses", "label": "sets user_id"},
    {"from": "rem", "to": "db", "kind": "uses", "label": "reads accounts"},
    {"from": "rem", "to": "push", "kind": "uses", "label": "send"},
 ]},
 "cd-ocr": {"classes": [
    {"id": "cam", "name": "CameraScreen", "stereo": "screen", "x": 20, "y": 20, "attrs": ["scanDate: Date", "scanUsage: ScanUsage"], "methods": ["handleCapture()", "handleGallery()", "ensureCanScan(): boolean", "shiftDay(direction)"]},
    {"id": "lim", "name": "ScanLimiter", "stereo": "module", "x": 20, "y": 260, "attrs": ["DAILY_GEMINI_SCAN_LIMIT = 5", "GEMINI_SCAN_RESET_HOUR = 8"], "methods": ["getDailyScanUsage(): ScanUsage", "canScanToday(): boolean", "consumeScan(): ScanUsage"]},
    {"id": "rev", "name": "ReviewScreen", "stereo": "screen", "x": 300, "y": 20, "attrs": ["entries: ParsedEntry[]", "ocrEngine: 'Gemini' | 'ML Kit'", "ocrWarning: string"],
     "methods": ["processOcr()", "updateEntry(index, field, value)", "deleteEntry(index)", "addEntry()", "handleConfirm()"]},
    {"id": "rate", "name": "RateValidator", "stereo": "module", "x": 300, "y": 300, "attrs": ["RATE_TABLE: Rate[]"], "methods": ["isKnownAmount(amount)", "isSuspiciousAmount(amount)"]},
    {"id": "parse", "name": "OcrParser", "stereo": "module", "x": 300, "y": 490, "attrs": [], "methods": ["parseOcrText(raw): ParsedEntry[]", "sanitizeAmountString(value)", "calculateTotal(entries)"]},
    {"id": "pe", "name": "ParsedEntry", "stereo": "type", "x": 20, "y": 490, "attrs": ["original_text: string", "name: string", "amount: number | null", "is_duplicate?: boolean"], "show_methods": False},
    {"id": "gem", "name": "GeminiService", "stereo": "module", "x": 660, "y": 20, "attrs": ["VALID_AMOUNTS_HINT: string"], "methods": ["processLogbookWithGemini(uri)"]},
    {"id": "api", "name": "Gemini API", "stereo": "external", "x": 660, "y": 180, "attrs": [], "methods": ["generateContent(image, prompt)"]},
    {"id": "ml", "name": "ML Kit Text Recognition", "stereo": "external", "x": 660, "y": 340, "attrs": [], "methods": ["recognizeText(uri)"]},
 ], "edges": [
    {"from": "cam", "to": "lim", "kind": "uses"},
    {"from": "cam", "to": "rev", "kind": "nav"},
    {"from": "rev", "to": "gem", "kind": "uses", "label": "online"},
    {"from": "gem", "to": "api", "kind": "uses", "label": "HTTPS, JSON"},
    {"from": "rev", "to": "ml", "kind": "uses", "label": "fallback", "a": ("right", 0.85), "b": ("left", 0.5), "via": [("h", 615), ("v", "b")]},
    {"from": "rev", "to": "rate", "kind": "uses", "label": "flag amounts", "a": ("bottom", 0.3), "b": ("top", 0.38)},
    {"from": "rev", "to": "parse", "kind": "uses", "label": "offline text", "a": ("bottom", 0.88), "b": ("top", 0.91)},
    {"from": "rev", "to": "lim", "kind": "uses", "label": "consumeScan()"},
    {"from": "parse", "to": "pe", "kind": "nav", "label": "creates"},
 ]},
 "cd-sync": {"classes": [
    {"id": "rev", "name": "ReviewScreen", "stereo": "screen", "x": 20, "y": 60, "attrs": [], "methods": ["doSave(validEntries)"]},
    {"id": "net", "name": "NetInfo", "stereo": "external", "x": 20, "y": 250, "attrs": [], "methods": ["fetch(): { isConnected }"]},
    {"id": "q", "name": "OfflineQueue", "stereo": "module", "x": 300, "y": 60, "attrs": ["storage: AsyncStorage"], "methods": ["getQueue(): OfflineQueueItem[]", "addToQueue(upload, entries)", "removeFromQueue(id)", "syncQueue(): { synced, failed }"]},
    {"id": "sb", "name": "Supabase Database", "stereo": "external", "x": 650, "y": 60, "attrs": [], "methods": ["insert / upsert logbook_uploads", "insert / upsert logbook_entries"]},
    {"id": "qi", "name": "OfflineQueueItem", "stereo": "type", "x": 300, "y": 300, "attrs": ["id: uuid", "upload: LogbookUpload", "entries: ParsedEntry[]", "queued_at: timestamp"], "show_methods": False},
    {"id": "up", "name": "LogbookUpload", "stereo": "type", "x": 300, "y": 500, "attrs": ["id: uuid", "date: date", "staff_id: uuid", "total_entries: integer", "total_amount: numeric", "is_synced: boolean", "synced_at: timestamp", "created_at: timestamp"], "show_methods": False},
    {"id": "en", "name": "LogbookEntry", "stereo": "type", "x": 650, "y": 500, "attrs": ["id: uuid", "upload_id: uuid", "original_text: string", "name: string", "amount: numeric | null", "is_confirmed: boolean", "is_duplicate: boolean"], "show_methods": False},
 ], "edges": [
    {"from": "rev", "to": "net", "kind": "uses", "label": "check connection"},
    {"from": "rev", "to": "q", "kind": "uses", "label": "offline"},
    {"from": "rev", "to": "sb", "kind": "uses", "label": "insert (online)", "a": ("top", 0.5), "b": ("top", 0.5), "via": [("v", 25), ("h", "b")]},
    {"from": "q", "to": "sb", "kind": "uses", "label": "upsert on sync"},
    {"from": "q", "to": "qi", "kind": "comp", "m1": "1", "m2": "*"},
    {"from": "qi", "to": "up", "kind": "assoc", "m2": "1"},
    {"from": "up", "to": "en", "kind": "comp", "m1": "1", "m2": "1..*"},
 ]},
 "cd-owner": {"classes": [
    {"id": "dash", "name": "DashboardScreen", "stereo": "screen", "x": 20, "y": 20, "attrs": ["stats: RevenueStats"], "methods": ["load()", "onRefresh()"]},
    {"id": "hist", "name": "OwnerHistoryScreen", "stereo": "screen", "x": 20, "y": 190, "attrs": ["uploads: LogbookUpload[]", "selectedUpload: LogbookUpload"], "methods": ["openDetail(upload)"]},
    {"id": "set", "name": "OwnerSettingsScreen", "stereo": "screen", "x": 20, "y": 370, "attrs": [], "methods": ["editProfile()", "changePassword()", "showSyncStatus()", "exportCSV()"]},
    {"id": "staff", "name": "StaffManagementScreen", "stereo": "screen", "x": 20, "y": 620, "attrs": ["staff: UserProfile[]"], "methods": ["handleToggleActive(member)"]},
    {"id": "ds", "name": "DataService", "stereo": "module", "x": 330, "y": 220, "attrs": [], "methods": ["fetchRevenueStats(): RevenueStats", "fetchUploadHistory(limit)", "fetchUploadEntries(uploadId)", "fetchStaffList(): UserProfile[]", "fetchTodayUploads(staffId)", "fetchAllUploads(staffId, limit, offset)"]},
    {"id": "rs", "name": "RevenueStats", "stereo": "type", "x": 710, "y": 20, "attrs": ["daily: number", "weekly: number", "monthly: number", "yearly: number", "daily_history: DailyRevenue[]"], "show_methods": False},
    {"id": "dr", "name": "DailyRevenue", "stereo": "type", "x": 710, "y": 300, "attrs": ["date: date", "total: number", "entry_count: number"], "show_methods": False},
    {"id": "sb", "name": "Supabase Database", "stereo": "external", "x": 700, "y": 600, "attrs": [], "methods": ["select profiles, uploads, entries", "update profiles.is_active"]},
 ], "edges": [
    {"from": "dash", "to": "ds", "kind": "uses"}, {"from": "hist", "to": "ds", "kind": "uses"},
    {"from": "set", "to": "ds", "kind": "uses", "label": "export CSV"}, {"from": "staff", "to": "ds", "kind": "uses"},
    {"from": "ds", "to": "rs", "kind": "nav", "label": "returns"}, {"from": "rs", "to": "dr", "kind": "comp", "m1": "1", "m2": "*"},
    {"from": "ds", "to": "sb", "kind": "uses"}, {"from": "staff", "to": "sb", "kind": "uses", "label": "update is_active"},
 ]},
 "cd-desktop": {"classes": [
    {"id": "views", "name": "Desktop Views", "stereo": "screen", "x": 20, "y": 20, "attrs": ["Login, Dashboard, Members,", "Rates, Revenue, Logbook"], "show_methods": False},
    {"id": "api", "name": "ApiClient", "stereo": "module", "x": 360, "y": 20, "attrs": ["token: JWT"], "methods": ["login(email, password)", "fetchDashboard()", "fetchMembers(search, status, plan)", "createMember(data)", "updateMember(id, data)", "renewMember(id, payment)", "deleteMember(id)", "inviteMember(id, email)", "fetchRates(), saveRates(rates)"]},
    {"id": "srv", "name": "LocalApiServer", "stereo": "module", "x": 360, "y": 370, "attrs": ["host: 127.0.0.1", "port: 3001"], "methods": ["/api/login, /api/users/me", "/api/dashboard", "/api/members", "/api/rates", "/api/announcements", "/api/settings"]},
    {"id": "db", "name": "SQLite Database", "stereo": "external", "x": 20, "y": 420, "attrs": [], "methods": ["better-sqlite3, WAL mode"]},
    {"id": "mem", "name": "Member", "stereo": "table", "x": 720, "y": 20, "attrs": ["member_id: text", "name: text", "contact: text", "email: text", "plan: text", "status: text", "joined_date: date", "expiry_date: date", "photo: text", "invited_at: datetime"], "show_methods": False},
    {"id": "pay", "name": "MemberPayment", "stereo": "table", "x": 720, "y": 330, "attrs": ["receipt_no: text", "amount: real", "plan: text", "period_start: date", "period_end: date", "paid_at: datetime"], "show_methods": False},
    {"id": "rate", "name": "Rate", "stereo": "table", "x": 360, "y": 700, "attrs": ["category: text", "type: text", "monthly: real", "semi: real", "daily: real"], "show_methods": False},
    {"id": "user", "name": "User", "stereo": "table", "x": 720, "y": 590, "attrs": ["email: text", "password: bcrypt hash", "role: text"], "show_methods": False},
 ], "edges": [
    {"from": "views", "to": "api", "kind": "uses"},
    {"from": "api", "to": "srv", "kind": "uses", "label": "HTTP + JWT"},
    {"from": "srv", "to": "db", "kind": "uses", "label": "SQL"},
    {"from": "srv", "to": "mem", "kind": "assoc", "label": "manages"},
    {"from": "mem", "to": "pay", "kind": "comp", "m1": "1", "m2": "*"},
    {"from": "srv", "to": "rate", "kind": "assoc", "label": "manages"},
    {"from": "srv", "to": "user", "kind": "assoc", "label": "verifies"},
 ]},
 "cd-revenue": {"classes": [
    {"id": "rv", "name": "RevenueView", "stereo": "screen", "x": 20, "y": 20, "attrs": ["year, month", "activeFilter"], "methods": ["loadRevenue()", "exportRevenue()"]},
    {"id": "exp", "name": "ReportExporter", "stereo": "module", "x": 20, "y": 270, "attrs": [], "methods": ["GET /api/revenue/export", "builds a .docx report"]},
    {"id": "eng", "name": "RevenueEngine", "stereo": "module", "x": 290, "y": 20, "attrs": ["currentRates: Rate[]"], "methods": ["computeRevenueForDateRange()", "computeRevenueForYear()", "parsePlan(plan)", "lookupRate(category, type)", "getInitialPaymentAmount()"]},
    {"id": "db", "name": "DailyBreakdown", "stereo": "type", "x": 290, "y": 290, "attrs": ["logbookRevenue, logbookCount", "paymentRevenue, paymentCount", "total"], "show_methods": False},
    {"id": "nm", "name": "NameMatcher", "stereo": "module", "x": 290, "y": 480, "attrs": [], "methods": ["normalizeName(name)", "levenshtein(a, b)", "namesMatch(a, b): boolean"]},
    {"id": "sync", "name": "LogbookSync", "stereo": "module", "x": 610, "y": 20, "attrs": ["logbookCache (60 s)"], "methods": ["fetchLogbookUploads()", "fetchLogbookEntriesForUploads(ids)"]},
    {"id": "sql", "name": "SQLite Database", "stereo": "external", "x": 610, "y": 300, "attrs": [], "methods": ["members, member_payments, rates"]},
 ], "edges": [
    {"from": "rv", "to": "eng", "kind": "uses", "label": "GET /api/revenue"},
    {"from": "exp", "to": "eng", "kind": "uses"},
    {"from": "eng", "to": "db", "kind": "nav", "label": "produces", "a": ("bottom", 0.3), "b": ("top", 0.32)},
    {"from": "eng", "to": "nm", "kind": "uses", "a": ("left", 0.9), "b": ("left", 0.5), "via": [("h", 262), ("v", "b")]},
    {"from": "eng", "to": "sync", "kind": "uses", "label": "uploads, entries"},
    {"from": "eng", "to": "sql", "kind": "uses", "label": "payments, rates", "a": ("right", 0.85), "b": ("left", 0.4), "via": [("h", 565), ("v", "b")]},
 ]},
 "cd-logsync": {"classes": [
    {"id": "lv", "name": "LogbookView", "stereo": "screen", "x": 20, "y": 20, "attrs": ["selectedDate"], "methods": ["addEntries()", "saveEdit(entry)", "deleteEntry(entry)", "deleteAllForDate()"]},
    {"id": "routes", "name": "Logbook API", "stereo": "module", "x": 290, "y": 20, "attrs": [], "methods": ["GET /api/logbook?date", "GET /api/logbook/dates", "POST /api/logbook", "PUT /api/logbook/entries/:id", "DELETE /api/logbook/entries/:id", "DELETE /api/logbook?date"]},
    {"id": "sync", "name": "LogbookSync", "stereo": "module", "x": 290, "y": 330, "attrs": ["logbookCache (60 s)"], "methods": ["fetchLogbookUploads()", "fetchLogbookEntriesForUploads(ids)", "recomputeUploadTotals(uploadId)", "mirrorLocalLogbookEntry(entry, date)"]},
    {"id": "sb", "name": "Supabase Database", "stereo": "external", "x": 690, "y": 20, "attrs": [], "methods": ["logbook_uploads", "logbook_entries"]},
    {"id": "sql", "name": "SQLite Database", "stereo": "external", "x": 690, "y": 360, "attrs": [], "methods": ["logbook_entries_backup"]},
 ], "edges": [
    {"from": "lv", "to": "routes", "kind": "uses", "label": "HTTP + JWT"},
    {"from": "routes", "to": "sync", "kind": "uses"},
    {"from": "routes", "to": "sb", "kind": "uses", "label": "insert, update, delete"},
    {"from": "sync", "to": "sb", "kind": "uses", "label": "select, update totals"},
    {"from": "sync", "to": "sql", "kind": "uses", "label": "backup mirror"},
 ]},
}

# ------------------------------------------------------------------ ER diagrams
ERD = {
 "erd-cloud": {"entities": [
    {"name": "auth.users", "x": 20, "y": 20, "cols": [("id", "uuid", "PK"), ("email", "text", ""), ("encrypted_password", "text", "")]},
    {"name": "profiles", "x": 360, "y": 20, "cols": [("id", "uuid", "PK"), ("email", "text", ""), ("full_name", "text", ""), ("role", "text", ""), ("is_active", "boolean", ""), ("created_at", "timestamptz", "")]},
    {"name": "devices", "x": 700, "y": 20, "cols": [("id", "uuid", "PK"), ("device_name", "text", ""), ("owner_id", "uuid", "FK"), ("is_active", "boolean", ""), ("registered_at", "timestamptz", "")]},
    {"name": "logbook_uploads", "x": 360, "y": 300, "cols": [("id", "uuid", "PK"), ("date", "date", ""), ("staff_id", "uuid", "FK"), ("image_url", "text", ""), ("total_entries", "int", ""), ("total_amount", "numeric", ""), ("is_synced", "boolean", ""), ("synced_at", "timestamptz", ""), ("created_at", "timestamptz", "")]},
    {"name": "logbook_entries", "x": 700, "y": 300, "cols": [("id", "uuid", "PK"), ("upload_id", "uuid", "FK"), ("original_text", "text", ""), ("name", "text", ""), ("amount", "numeric", ""), ("is_confirmed", "boolean", ""), ("is_duplicate", "boolean", ""), ("created_at", "timestamptz", "")]},
    {"name": "member_accounts", "x": 20, "y": 200, "cols": [("id", "uuid", "PK"), ("member_id", "text", "UK"), ("user_id", "uuid", "FK"), ("name", "text", ""), ("email", "text", "UK"), ("plan", "text", ""), ("status", "text", ""), ("joined_date", "date", ""), ("expiry_date", "date", ""), ("push_token", "text", ""), ("last_reminder_on", "date", ""), ("invited_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]},
    {"name": "member_payments", "x": 20, "y": 610, "cols": [("id", "uuid", "PK"), ("account_id", "uuid", "FK"), ("receipt_no", "text", "UK"), ("amount", "numeric", ""), ("plan", "text", ""), ("period_start", "date", ""), ("period_end", "date", ""), ("paid_at", "timestamptz", "")]},
    {"name": "announcements", "x": 360, "y": 610, "cols": [("id", "uuid", "PK"), ("title", "text", ""), ("body", "text", ""), ("posted_at", "timestamptz", "")]},
    {"name": "rates", "x": 700, "y": 590, "cols": [("category", "text", "PK"), ("type", "text", "PK"), ("monthly", "numeric", ""), ("semi", "numeric", ""), ("daily", "numeric", ""), ("updated_at", "timestamptz", "")]},
 ], "rels": [
    {"one": "auth.users", "many": "profiles", "ya": 0, "yb": 0, "label": "extends", "oneone": True},
    {"one": "profiles", "many": "devices", "ya": 0, "yb": 2, "label": "owns (reserved)", "optional": True},
    {"one": "profiles", "many": "logbook_uploads", "side": "v", "label": "scans"},
    {"one": "logbook_uploads", "many": "logbook_entries", "ya": 0, "yb": 1, "label": "contains"},
    {"one": "auth.users", "many": "member_accounts", "side": "v", "label": "signs in as", "oneone": True, "optional": True},
    {"one": "member_accounts", "many": "member_payments", "side": "v", "label": "has", "optional": True},
 ]},
 "erd-desktop": {"entities": [
    {"name": "members", "x": 20, "y": 20, "cols": [("id", "integer", "PK"), ("member_id", "text", "UK"), ("name", "text", ""), ("contact", "text", ""), ("email", "text", ""), ("plan", "text", ""), ("status", "text", ""), ("joined_date", "date", ""), ("expiry_date", "date", ""), ("address", "text", ""), ("photo", "text", ""), ("cloud_id", "text", ""), ("invited_at", "datetime", ""), ("created_at", "datetime", ""), ("updated_at", "datetime", "")]},
    {"name": "rates", "x": 330, "y": 20, "cols": [("id", "integer", "PK"), ("category", "text", "UK"), ("type", "text", "UK"), ("monthly", "real", ""), ("semi", "real", ""), ("daily", "real", "")]},
    {"name": "users", "x": 640, "y": 20, "cols": [("id", "integer", "PK"), ("email", "text", "UK"), ("password", "text", ""), ("role", "text", ""), ("created_at", "datetime", "")]},
    {"name": "settings", "x": 330, "y": 230, "cols": [("id", "integer", "PK"), ("gym_name", "text", ""), ("contact", "text", ""), ("address", "text", "")]},
    {"name": "logbook_entries_backup", "x": 640, "y": 205, "cols": [("id", "text", "PK"), ("date", "text", ""), ("name", "text", ""), ("amount", "real", ""), ("upload_id", "text", ""), ("created_at", "text", "")]},
    {"name": "member_payments", "x": 20, "y": 460, "cols": [("id", "text", "PK"), ("member_id", "integer", "FK"), ("receipt_no", "text", "UK"), ("amount", "real", ""), ("plan", "text", ""), ("period_start", "date", ""), ("period_end", "date", ""), ("paid_at", "datetime", "")]},
    {"name": "sync_outbox", "x": 330, "y": 420, "cols": [("id", "integer", "PK"), ("entity", "text", ""), ("record_id", "text", ""), ("action", "text", ""), ("queued_at", "datetime", ""), ("attempts", "integer", "")]},
 ], "rels": [
    {"one": "members", "many": "member_payments", "side": "v", "label": "pays"},
 ]},
}

# ------------------------------------------------------------------ sequence diagrams
A, S, E = "actor", "obj", "ext"
SEQ = {
 "sd-signin": {"participants": [("u", "Staff / Owner", A), ("login", "LoginScreen", S), ("auth", "AuthContext", S), ("sa", "Supabase\nAuth", E), ("db", "Supabase\nprofiles", E), ("nav", "RootNavigator", S)], "gap": 160,
  "messages": [("u", "login", "email, password"), ("login", "auth", "signIn(email, password)"), ("auth", "sa", "signInWithPassword()"),
               ("sa", "auth", "session", "return"), ("auth", "db", "select profile by user id"), ("db", "auth", "profile (role, is_active)", "return"),
               ("auth", "auth", "sign out if is_active = false"), ("auth", "nav", "profile loaded"), ("nav", "u", "StaffTabs or OwnerTabs", "return"),
               ("sa", "auth", "invalid credentials", "return"), ("login", "u", "show error", "return")],
  "fragments": [{"start": 3, "end": 10, "label": "alt [valid credentials]", "span": ["u", "nav"], "else": 9, "else_label": "[invalid credentials]"}]},
 "sd-online": {"participants": [("u", "Staff", A), ("cam", "CameraScreen", S), ("lim", "ScanLimiter", S), ("rev", "ReviewScreen", S), ("gem", "GeminiService", S), ("api", "Gemini API", E), ("rate", "RateValidator", S)], "gap": 150,
  "messages": [("u", "cam", "set log date, capture"), ("cam", "lim", "getDailyScanUsage()"), ("lim", "cam", "remaining scans", "return"),
               ("cam", "rev", "navigate(imageUri, scanDate)"), ("rev", "rev", "resize image to 1,600 px"), ("rev", "gem", "processLogbookWithGemini()"),
               ("gem", "api", "generateContent()"), ("api", "gem", "entries as JSON", "return"), ("gem", "rev", "{ ok: true, entries }", "return"),
               ("rev", "lim", "consumeScan()"), ("rev", "rate", "isSuspiciousAmount(amount)"), ("rate", "rev", "flags", "return"),
               ("rev", "u", "editable rows (Gemini 2.5 AI)", "return")]},
 "sd-offline": {"participants": [("u", "Staff", A), ("rev", "ReviewScreen", S), ("gem", "GeminiService", S), ("ml", "ML Kit\n(on device)", E), ("parse", "OcrParser", S), ("rate", "RateValidator", S)], "gap": 165,
  "messages": [("rev", "gem", "processLogbookWithGemini(uri)"), ("gem", "rev", "{ ok: false, reason }", "return"), ("rev", "ml", "recognizeText(uri)"),
               ("ml", "rev", "raw text", "return"), ("rev", "parse", "parseOcrText(text)"), ("parse", "parse", "remove row numbers and payment tags"),
               ("parse", "parse", "fix O→0, l→1, S→5; mark duplicates"), ("parse", "rev", "ParsedEntry[]", "return"), ("rev", "rate", "isSuspiciousAmount(amount)"),
               ("rate", "rev", "flags", "return"), ("rev", "u", "rows + warning (Local ML Kit)", "return")]},
 "sd-save": {"participants": [("u", "Staff", A), ("rev", "ReviewScreen", S), ("net", "NetInfo", E), ("sb", "Supabase\nDatabase", E), ("q", "OfflineQueue", S)],
  "messages": [("u", "rev", "Confirm & Save"), ("rev", "net", "fetch()"), ("net", "rev", "isConnected", "return"),
               ("rev", "sb", "insert logbook_uploads"), ("rev", "sb", "insert logbook_entries"), ("sb", "rev", "ok", "return"),
               ("rev", "q", "addToQueue(upload, entries)"), ("rev", "u", "success screen", "return"), ("rev", "q", "syncQueue()"),
               ("q", "sb", "upsert upload and entries"), ("sb", "q", "ok", "return"), ("q", "q", "removeFromQueue(id)")],
  "fragments": [{"start": 3, "end": 6, "label": "alt [online]", "span": ["rev", "q"], "else": 6, "else_label": "[offline or insert failed]"},
                {"start": 9, "end": 11, "label": "loop [each queued page]", "span": ["rev", "q"]}]},
 "sd-revenue": {"participants": [("u", "Administrator", A), ("view", "RevenueView", S), ("api", "Local API\n(Express)", S), ("eng", "RevenueEngine", S), ("sync", "LogbookSync", S), ("sb", "Supabase", E), ("sql", "SQLite", E)], "gap": 152, "step": 40,
  "messages": [("u", "view", "open Revenue, pick month"), ("view", "api", "GET /api/revenue?year&month"), ("api", "sync", "fetchLogbookUploads()"),
               ("sync", "sb", "select uploads"), ("sb", "sync", "uploads", "return"), ("sync", "api", "uploads", "return"),
               ("api", "eng", "computeRevenueForDateRange()"), ("eng", "sql", "members, rates"), ("sql", "eng", "rows", "return"),
               ("eng", "sync", "fetchLogbookEntriesForUploads(ids)"), ("sync", "sb", "select entries"), ("sb", "sync", "entries", "return"), ("sync", "eng", "entries", "return"),
               ("eng", "eng", "add logbook totals per day"), ("eng", "eng", "skip payment if same name"),
               ("eng", "api", "daily breakdown, totals", "return"), ("api", "view", "revenue JSON", "return"), ("view", "u", "chart, totals, breakdowns", "return")]},
 "sd-logbook": {"participants": [("u", "Administrator", A), ("view", "LogbookView", S), ("api", "Local API\n(Express)", S), ("sb", "Supabase", E), ("sql", "SQLite", E)], "gap": 190,
  "messages": [("u", "view", "edit entry, Save"), ("view", "api", "PUT /api/logbook/entries/:id"), ("api", "sb", "update logbook_entries"), ("sb", "api", "ok", "return"),
               ("api", "sb", "recomputeUploadTotals(uploadId)"), ("api", "sql", "mirror entry in backup table"), ("api", "view", "updated entry", "return"),
               ("view", "u", "refreshed list and day total", "return")]},
 "sd-invite": {"participants": [("a", "Administrator", A), ("mv", "MembersView", S), ("api", "Local API\n(Express)", S), ("db", "Supabase\nDatabase", E), ("fn", "member-access\nfunction", E), ("sa", "Supabase\nAuth", E), ("m", "Member", A)], "gap": 148, "step": 40,
  "messages": [("a", "mv", "Send Invite Link"), ("mv", "api", "POST /api/members/:id/invite"), ("api", "db", "upsert member_accounts"), ("api", "db", "upsert member_payments"),
               ("api", "fn", "invite(account id)"), ("fn", "fn", "check caller is an owner"), ("fn", "sa", "inviteUserByEmail()"), ("sa", "m", "email with sign-in link"),
               ("fn", "db", "set user_id, invited_at"), ("fn", "api", "invited", "return"), ("api", "mv", "status: Invited", "return"),
               ("m", "sa", "open the link"), ("sa", "m", "session", "return"), ("m", "db", "select own account"), ("db", "m", "membership (RLS)", "return")]},
 "sd-reminder": {"participants": [("cron", "pg_cron\n8:00 AM", E), ("fn", "send-reminders\nfunction", E), ("db", "Supabase\nDatabase", E), ("push", "Expo Push\nService", E), ("m", "Member", A), ("app", "MemberHome\nScreen", S)], "gap": 160, "step": 40,
  "messages": [("cron", "fn", "run daily"), ("fn", "db", "plans expiring in 7, 3, 1 days"), ("db", "fn", "accounts, push tokens", "return"),
               ("fn", "fn", "skip if sent today"), ("fn", "push", "send(token, message)"), ("push", "m", "notification"), ("push", "fn", "ticket", "return"),
               ("fn", "db", "last_reminder_on = today"), ("m", "app", "tap notification"), ("app", "db", "select own account"), ("db", "app", "membership", "return"),
               ("app", "m", "days left, renew at front desk", "return")],
  "fragments": [{"start": 3, "end": 7, "label": "loop [each member]", "span": ["fn", "push"]}]},
}

# ------------------------------------------------------------------ architecture (HTML)
ARCH_HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0} body{font-family:Arial,Helvetica,sans-serif;background:#fff;padding:20px;width:1000px}
.layer{display:flex;gap:18px;align-items:stretch;margin-bottom:18px}
.lab{width:120px;flex:none;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:18px;color:#1446B3;border:2px solid #1446B3;border-radius:10px;background:#E8EEFB;padding:8px}
.col{flex:1;border:2px solid #1f2328;border-radius:10px;padding:12px 14px;background:#fff}
.col h3{font-size:19px;margin-bottom:8px;color:#1f2328}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{max-width:100%;font-size:17px;border:1.5px solid #9aa3b2;border-radius:6px;padding:5px 9px;background:#F6F8FC}
.ext .chip{background:#FFF6E5;border-color:#D9A441}
.note{font-size:16px;color:#555;margin-top:6px}
</style></head><body>
<div class="layer"><div class="lab">Presentation</div>
 <div class="col"><h3>Mobile App (React Native, Expo)</h3><div class="chips"><span class="chip">LoginScreen</span><span class="chip">CameraScreen</span><span class="chip">ReviewScreen</span><span class="chip">UploadSuccess</span><span class="chip">StaffHistory</span><span class="chip">Dashboard</span><span class="chip">OwnerHistory</span><span class="chip">StaffManagement</span><span class="chip">OwnerSettings</span><span class="chip">MemberLogin</span><span class="chip">MemberHome</span><span class="chip">MemberPayments</span><span class="chip">Receipt</span><span class="chip">MemberRates</span></div></div>
 <div class="col"><h3>Desktop App (Electron, React, Vite)</h3><div class="chips"><span class="chip">Login</span><span class="chip">Dashboard</span><span class="chip">Members</span><span class="chip">Rates</span><span class="chip">Revenue</span><span class="chip">Logbook</span></div></div>
</div>
<div class="layer"><div class="lab">Application Logic</div>
 <div class="col"><h3>Mobile services</h3><div class="chips"><span class="chip">AuthContext</span><span class="chip">GeminiService</span><span class="chip">OcrParser</span><span class="chip">RateValidator</span><span class="chip">ScanLimiter</span><span class="chip">OfflineQueue</span><span class="chip">DataService</span><span class="chip">MemberService</span><span class="chip">NotificationService</span></div></div>
 <div class="col"><h3>Local API (Express, 127.0.0.1:3001)</h3><div class="chips"><span class="chip">Auth (bcrypt, JWT)</span><span class="chip">Members</span><span class="chip">Rates</span><span class="chip">LogbookSync</span><span class="chip">RevenueEngine</span><span class="chip">ReportExporter</span><span class="chip">MemberSync</span></div></div>
</div>
<div class="layer"><div class="lab">Data</div>
 <div class="col"><h3>On the phone</h3><div class="chips"><span class="chip">AsyncStorage: offline queue, scan counter</span><span class="chip">Secure Store: session</span></div></div>
 <div class="col" style="border-color:#1446B3"><h3 style="color:#1446B3">Supabase Cloud (shared record)</h3><div class="chips"><span class="chip">PostgreSQL</span><span class="chip">Auth</span><span class="chip">Row-Level Security</span><span class="chip">Edge Functions</span></div><div class="note">profiles · logbook_uploads · logbook_entries · devices · member_accounts · member_payments · rates · announcements</div></div>
 <div class="col"><h3>On the desktop</h3><div class="chips"><span class="chip">SQLite: members, member_payments, rates, settings, users, sync_outbox</span></div></div>
</div>
<div class="layer ext"><div class="lab">External Services</div>
 <div class="col"><div class="chips"><span class="chip">Google Gemini API (Gemini 2.5 Flash): online OCR</span><span class="chip">Google ML Kit: offline OCR on the phone</span><span class="chip">Expo Push Service: renewal reminders</span><span class="chip">Expo EAS: Android builds and updates</span><span class="chip">GitHub Releases: desktop updates</span></div></div>
</div>
</body></html>"""


def render_html(html, png, W=1060, H=1400):
    f = FIG / "arch.html"; f.write_text(html, encoding="utf-8")
    from edge import screenshot
    screenshot(f, png, W, H)  # waits until Edge has written the file
    f.unlink()
    im = Image.open(png).convert("RGB")
    bbox = ImageChops.difference(im, Image.new("RGB", im.size, "white")).getbbox()
    im.crop((max(0, bbox[0] - 20), max(0, bbox[1] - 20), min(im.width, bbox[2] + 20), min(im.height, bbox[3] + 20))).save(png)


def phone(name, out):
    im = Image.open(SCREENS / "mobile" / f"{name}.png").convert("RGB")
    h = 1600; w = int(im.width * h / im.height); im = im.resize((w, h))
    bez = 26
    frame = Image.new("RGB", (w + 2 * bez, h + 2 * bez), "white")
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=90, fill="#05070D")
    mask = Image.new("L", (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=66, fill=255)
    frame.paste(im, (bez, bez), mask); frame.save(out)


def desktop(name, out):
    im = Image.open(SCREENS / "desktop" / f"{name}.png").convert("RGB")
    o = Image.new("RGB", (im.width + 6, im.height + 6), "#9aa0a6"); o.paste(im, (3, 3)); o.save(out)


def pair(a, b, la, lb, out):
    """Two framed phone screens side by side, each with a small label underneath."""
    from PIL import ImageFont
    pa, pb = FIG / f"ui-{a}.png", FIG / f"ui-{b}.png"
    phone(a, pa); phone(b, pb)
    A, B = Image.open(pa), Image.open(pb)
    gap, lab = 120, 110
    im = Image.new("RGB", (A.width + B.width + gap, max(A.height, B.height) + lab), "white")
    im.paste(A, (0, 0)); im.paste(B, (A.width + gap, 0))
    d = ImageDraw.Draw(im); f = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 54)
    for x0, w, text in ((0, A.width, la), (A.width + gap, B.width, lb)):
        tw = d.textlength(text, font=f); d.text((x0 + (w - tw) / 2, A.height + 30), text, fill="#1f2328", font=f)
    im.save(out); pa.unlink(); pb.unlink()


MOBILE_UI = ["m-login"]
MOBILE_PAIRS = [("m-camera", "m-processing", "(a) Scan", "(b) Processing"),
                ("m-review", "m-review-offline", "(a) Online reading", "(b) Offline reading"),
                ("m-success", "m-staffhistory", "(a) Upload Success", "(b) Staff History"),
                ("m-dashboard", "m-ownerhistory", "(a) Dashboard", "(b) Revenue History"),
                ("m-staffmgmt", "m-settings", "(a) Staff Management", "(b) Settings"),
                ("m-member-login", "m-member-home", "(a) Member Sign In", "(b) Home"),
                ("m-member-payments", "m-member-receipt", "(a) My Payments", "(b) Receipt"),
                ("m-member-reminder", "m-member-rates", "(a) Renewal Reminder", "(b) Rates & News")]
DESKTOP_UI = ["d-dashboard", "d-members", "d-member-invite", "d-rates", "d-revenue", "d-logbook"]

if __name__ == "__main__":
    only = sys.argv[1:]
    def want(k): return not only or any(k.startswith(o) for o in only)
    if want("arch"): render_html(ARCH_HTML, FIG / "arch.png")
    for k, spec in CLASS.items():
        if want(k): D.class_diagram(spec, FIG / f"{k}.png"); print(k)
    for k, spec in ERD.items():
        if want(k): D.erd(spec, FIG / f"{k}.png"); print(k)
    for k, spec in SEQ.items():
        if want(k): D.sequence_diagram(spec, FIG / f"{k}.png"); print(k)
    if want("ui"):
        for old in FIG.glob("ui-*.png"): old.unlink()
        for n in MOBILE_UI: phone(n, FIG / f"ui-{n}.png")
        for a, b, la, lb in MOBILE_PAIRS: pair(a, b, la, lb, FIG / f"ui-{a}+{b}.png")
        for n in DESKTOP_UI: desktop(n, FIG / f"ui-{n}.png")
        print("ui done")
