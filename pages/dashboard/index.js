"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardPage;
var react_1 = require("react");
var router_1 = require("next/router");
var Layout_1 = require("@/components/Layout");
var useSession_1 = require("@/lib/useSession");
var commercialGoals_1 = require("@/lib/commercialGoals");
var folderIcons_1 = require("@/lib/folderIcons");
var useWallet_1 = require("@/lib/useWallet");
var admin_1 = require("@/lib/admin");
var globalDeskTemplate_1 = require("@/lib/globalDeskTemplate");
var DESK_WIDTH = 1400;
var DESK_HEIGHT = 760;
var DESK_FOLDER_WIDTH = 164;
var DESK_FOLDER_HEIGHT = 142;
var DESK_SHEET_WIDTH = 184;
var DESK_SHEET_HEIGHT = 132;
var DESK_STORAGE_PREFIX = "commercialDeskLayout:v1835:";
var GLOBAL_DESK_TEMPLATE_STORAGE_KEY = "commercialGlobalDeskTemplate:v1839";
var SCENE_WIDGETS_STORAGE_PREFIX = "commercialSceneWidgets:v1840:";
var DESKTOP_VARIANT_STORAGE_PREFIX = "commercialDesktopVariant:v1841:";
var TRAY_GUIDE_TEXT_STORAGE_PREFIX = "commercialTrayGuideText:v1836:";
var TRASH_STORAGE_PREFIX = "commercialTrash:v18365:";
var TRASH_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
var BOARD_ZONE = { x: 238, y: 124, width: 770, height: 214 };
var TRAY_ZONE = { x: 1042, y: 520, width: 246, height: 168 };
var TRAY_CLIP = { x: 1050, y: 526, width: 226, height: 124 };
var SHEET_ZONE = { x: 110, y: 618, width: 760, height: 110 };
var TRASH_ZONE = { x: 16, y: 434, width: 160, height: 180 };
var TRAY_GUIDE_ID = "guide:tray";
var TRASH_GUIDE_ID = "guide:trash";
var GOAL_ORDER = Object.fromEntries(commercialGoals_1.COMMERCIAL_GOALS.map(function (item, index) { return [item.key, index + 1]; }));
function sortProjects(list) {
    return __spreadArray([], list, true).sort(function (a, b) {
        var _a, _b;
        var goalDelta = (GOAL_ORDER[a.goal] || 99) - (GOAL_ORDER[b.goal] || 99);
        if (goalDelta !== 0)
            return goalDelta;
        var nameA = (((_a = a.person) === null || _a === void 0 ? void 0 : _a.full_name) || a.title || "").toLowerCase();
        var nameB = (((_b = b.person) === null || _b === void 0 ? void 0 : _b.full_name) || b.title || "").toLowerCase();
        var nameDelta = nameA.localeCompare(nameB, "ru");
        if (nameDelta !== 0)
            return nameDelta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}
function getInitials(value) {
    var parts = value
        .split(/\s+/)
        .map(function (part) { return part.trim(); })
        .filter(Boolean)
        .slice(0, 2);
    if (!parts.length)
        return "PR";
    return parts.map(function (part) { var _a; return ((_a = part[0]) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || ""; }).join("");
}
function getEntityTilt(seedSource, spread) {
    if (spread === void 0) { spread = 4; }
    var seed = Array.from(seedSource).reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0);
    return ((seed % (spread * 2 + 1)) - spread) * 1.2;
}
function getStickyNoteTone(goal) {
    switch (goal) {
        case "motivation":
            return "sticky-note-gold";
        case "general_assessment":
            return "sticky-note-mint";
        case "management_potential":
        case "leadership":
            return "sticky-note-blue";
        case "team_interaction":
        case "communication_influence":
            return "sticky-note-peach";
        case "self_organization":
        case "learning_agility":
            return "sticky-note-lilac";
        case "emotional_regulation":
            return "sticky-note-rose";
        default:
            return "sticky-note-cream";
    }
}
function goalColor(goal) {
    switch (goal) {
        case "motivation":
            return "from-emerald-200 to-green-100 text-emerald-950 border-emerald-300";
        case "general_assessment":
            return "from-teal-200 to-emerald-100 text-teal-950 border-teal-300";
        case "management_potential":
        case "leadership":
            return "from-sky-200 to-cyan-100 text-sky-950 border-sky-300";
        case "team_interaction":
        case "communication_influence":
            return "from-amber-200 to-yellow-100 text-amber-950 border-amber-300";
        case "self_organization":
        case "learning_agility":
            return "from-violet-200 to-indigo-100 text-violet-950 border-violet-300";
        case "emotional_regulation":
            return "from-rose-200 to-pink-100 text-rose-950 border-rose-300";
        default:
            return "from-lime-200 to-emerald-100 text-lime-950 border-lime-300";
    }
}
function getGreeneryLevel(amountRub, isUnlimited) {
    if (isUnlimited === void 0) { isUnlimited = false; }
    if (isUnlimited)
        return 4;
    if (amountRub >= 5000)
        return 4;
    if (amountRub >= 2500)
        return 3;
    if (amountRub >= 1000)
        return 2;
    if (amountRub >= 300)
        return 1;
    return 0;
}
function getGreeneryLabel(level) {
    switch (level) {
        case 4:
            return "Премиальный кабинет";
        case 3:
            return "Густая зелень";
        case 2:
            return "Живой интерьер";
        case 1:
            return "Первые вьюны";
        default:
            return "Чистый кабинет";
    }
}
function getGreeneryHint(level) {
    switch (level) {
        case 4:
            return "Окна и панели уже мягко обрамлены реалистичной зеленью, а кабинет выглядит как дорогой живой интерьер.";
        case 3:
            return "Вьюны уже хорошо видны по рамкам и собирают интерьер в цельную живую композицию.";
        case 2:
            return "Зелень заметно оживляет панели: по краям окон уже идут первые уверенные линии вьюнов.";
        case 1:
            return "Появились первые аккуратные вьюны вокруг окон и карточек.";
        default:
            return "Пока кабинет остаётся чистым и строгим. Чем больше пополнений, тем богаче станет живая зелень вокруг окон.";
    }
}
function clampDesk(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function isInsideTrayZone(x, y) {
    return x >= TRAY_ZONE.x && x <= TRAY_ZONE.x + TRAY_ZONE.width && y >= TRAY_ZONE.y && y <= TRAY_ZONE.y + TRAY_ZONE.height;
}
function getGuideClipRect(position) {
    var _a, _b, _c, _d, _e, _f;
    var x = Math.round((_a = position === null || position === void 0 ? void 0 : position.x) !== null && _a !== void 0 ? _a : getDefaultTrayGuidePosition().x);
    var y = Math.round((_b = position === null || position === void 0 ? void 0 : position.y) !== null && _b !== void 0 ? _b : getDefaultTrayGuidePosition().y);
    var width = Math.round((_d = (_c = position === null || position === void 0 ? void 0 : position.width) !== null && _c !== void 0 ? _c : getDefaultTrayGuidePosition().width) !== null && _d !== void 0 ? _d : 228);
    var height = Math.round((_f = (_e = position === null || position === void 0 ? void 0 : position.height) !== null && _e !== void 0 ? _e : getDefaultTrayGuidePosition().height) !== null && _f !== void 0 ? _f : 104);
    return { x: x, y: y, width: width, height: height };
}
function getGuideTransform(position) {
    var rotation = (position === null || position === void 0 ? void 0 : position.rotation) || 0;
    var tiltX = (position === null || position === void 0 ? void 0 : position.tiltX) || 0;
    var tiltY = (position === null || position === void 0 ? void 0 : position.tiltY) || 0;
    return "perspective(1400px) rotateX(".concat(tiltX, "deg) rotateY(").concat(tiltY, "deg) rotate(").concat(rotation, "deg)");
}
function getGuideClipPath(position) {
    var _a, _b, _c, _d;
    var width = Math.max(24, Number((position === null || position === void 0 ? void 0 : position.width) || getDefaultTrayGuidePosition().width || 228));
    var height = Math.max(24, Number((position === null || position === void 0 ? void 0 : position.height) || getDefaultTrayGuidePosition().height || 104));
    var tlx = Math.min(width, Math.max(0, Number((position === null || position === void 0 ? void 0 : position.clipTlx) || 0)));
    var tly = Math.min(height, Math.max(0, Number((position === null || position === void 0 ? void 0 : position.clipTly) || 0)));
    var trx = Math.min(width, Math.max(0, Number((_a = position === null || position === void 0 ? void 0 : position.clipTrx) !== null && _a !== void 0 ? _a : width)));
    var trY = Math.min(height, Math.max(0, Number((position === null || position === void 0 ? void 0 : position.clipTry) || 0)));
    var brx = Math.min(width, Math.max(0, Number((_b = position === null || position === void 0 ? void 0 : position.clipBrx) !== null && _b !== void 0 ? _b : width)));
    var bry = Math.min(height, Math.max(0, Number((_c = position === null || position === void 0 ? void 0 : position.clipBry) !== null && _c !== void 0 ? _c : height)));
    var blx = Math.min(width, Math.max(0, Number((position === null || position === void 0 ? void 0 : position.clipBlx) || 0)));
    var bly = Math.min(height, Math.max(0, Number((_d = position === null || position === void 0 ? void 0 : position.clipBly) !== null && _d !== void 0 ? _d : height)));
    var area = Math.abs(tlx * trY + trx * bry + brx * bly + blx * tly -
        tly * trx - trY * brx - bry * blx - bly * tlx) / 2;
    if (!Number.isFinite(area) || area < width * height * 0.08) {
        return "polygon(0px 0px, ".concat(width, "px 0px, ").concat(width, "px ").concat(height, "px, 0px ").concat(height, "px)");
    }
    return "polygon(".concat(tlx, "px ").concat(tly, "px, ").concat(trx, "px ").concat(trY, "px, ").concat(brx, "px ").concat(bry, "px, ").concat(blx, "px ").concat(bly, "px)");
}
function getDeskStorageKey(workspaceId) {
    return "".concat(DESK_STORAGE_PREFIX).concat(workspaceId);
}
function readGlobalDeskTemplates() {
    if (typeof window === "undefined")
        return {};
    try {
        var raw = window.localStorage.getItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY);
        if (!raw)
            return {};
        return (0, globalDeskTemplate_1.pickTemplatePositions)(JSON.parse(raw));
    }
    catch (_a) {
        return {};
    }
}
function writeGlobalDeskTemplates(source) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(GLOBAL_DESK_TEMPLATE_STORAGE_KEY, JSON.stringify((0, globalDeskTemplate_1.pickTemplatePositions)(source)));
    }
    catch (_a) { }
}
function getSceneWidgetsStorageKey(workspaceId, variant) {
    if (variant === void 0) { variant = "scheme"; }
    return variant === "scheme"
        ? "".concat(SCENE_WIDGETS_STORAGE_PREFIX).concat(workspaceId)
        : "".concat(SCENE_WIDGETS_STORAGE_PREFIX).concat(workspaceId, ":").concat(variant);
}
function getDesktopVariantStorageKey(workspaceId) {
    return "".concat(DESKTOP_VARIANT_STORAGE_PREFIX).concat(workspaceId);
}
function getTrayGuideTextStorageKey(workspaceId) {
    return "".concat(TRAY_GUIDE_TEXT_STORAGE_PREFIX).concat(workspaceId);
}
function getTrashStorageKey(workspaceId) {
    return "".concat(TRASH_STORAGE_PREFIX).concat(workspaceId);
}
function buildSchemeSceneWidgets(params) {
    return [
        { id: "board-scheme", kind: "image", text: "", src: "/dashboard-board-marker-scheme-transparent.png", action: "none", tone: "scheme", x: 52, y: 26, width: 1296, height: 716, rotation: 0, fontSize: 0, z: 10 },
        { id: "create-project", kind: "button", text: "Создать проект", action: "createProject", tone: "buttonPrimary", x: 230, y: 330, width: 360, height: 110, rotation: 0.4, fontSize: 30, z: 31 },
        { id: "open-tests", kind: "button", text: "Каталог тестов", action: "openCatalog", tone: "buttonPrimary", x: 770, y: 330, width: 388, height: 110, rotation: -0.2, fontSize: 30, z: 31 },
    ];
}
function buildClassicSceneWidgets(params) {
    return [];
}
function getClassicFolderPosition(index) {
    var col = Math.floor(index / 6);
    var row = index % 6;
    return {
        x: 58 + col * 156,
        y: 88 + row * 124,
        z: 80 + index,
    };
}
function getClassicProjectPosition(index) {
    var col = Math.floor(index / 6);
    var row = index % 6;
    return {
        x: 232 + col * 156,
        y: 88 + row * 124,
        z: 180 + index,
    };
}
function getDefaultFolderPosition(index) {
    return {
        x: TRAY_CLIP.x + 8 + index * 16,
        y: TRAY_CLIP.y + 10 + index * 8,
        z: 30 + index,
    };
}
function getDefaultProjectPosition(index) {
    var row = Math.floor(index / 3);
    var col = index % 3;
    var offsets = [
        { x: 0, y: 4 },
        { x: 206, y: 16 },
        { x: 418, y: 10 },
    ];
    var offset = offsets[col] || offsets[0];
    return {
        x: SHEET_ZONE.x + offset.x + row * 18,
        y: SHEET_ZONE.y + offset.y + row * 12,
        z: 180 + index,
    };
}
function getDefaultTrayGuidePosition() {
    return {
        x: 1208,
        y: 604,
        z: 18,
        width: 228,
        height: 104,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
        clipTlx: 0,
        clipTly: 10,
        clipTrx: 214,
        clipTry: 0,
        clipBrx: 228,
        clipBry: 92,
        clipBlx: 16,
        clipBly: 104,
    };
}
function getDefaultTrashGuidePosition() {
    return {
        x: TRASH_ZONE.x,
        y: TRASH_ZONE.y,
        z: 18,
        width: TRASH_ZONE.width,
        height: TRASH_ZONE.height,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
    };
}
function mergeDeskPositions(folders, projects, saved) {
    var next = {};
    next[TRAY_GUIDE_ID] = saved[TRAY_GUIDE_ID] || getDefaultTrayGuidePosition();
    next[TRASH_GUIDE_ID] = saved[TRASH_GUIDE_ID] || getDefaultTrashGuidePosition();
    var folderTemplate = saved[globalDeskTemplate_1.FOLDER_TEMPLATE_ID] || {};
    var projectTemplate = saved[globalDeskTemplate_1.PROJECT_TEMPLATE_ID] || {};
    var trayRect = getGuideClipRect(next[TRAY_GUIDE_ID]);
    folders.forEach(function (folder, index) {
        var key = "folder:".concat(folder.id);
        next[key] = saved[key] || {
            x: trayRect.x + 8 + index * 12,
            y: trayRect.y + 6 + index * 7,
            z: 20 + index,
            width: folderTemplate.width,
            height: folderTemplate.height,
            rotation: folderTemplate.rotation,
            tiltX: folderTemplate.tiltX,
            tiltY: folderTemplate.tiltY,
            clipTlx: folderTemplate.clipTlx,
            clipTly: folderTemplate.clipTly,
            clipTrx: folderTemplate.clipTrx,
            clipTry: folderTemplate.clipTry,
            clipBrx: folderTemplate.clipBrx,
            clipBry: folderTemplate.clipBry,
            clipBlx: folderTemplate.clipBlx,
            clipBly: folderTemplate.clipBly,
        };
    });
    projects.forEach(function (project, index) {
        var key = "project:".concat(project.id);
        next[key] = saved[key] || __assign(__assign({}, getDefaultProjectPosition(index)), { width: projectTemplate.width, height: projectTemplate.height, rotation: projectTemplate.rotation, tiltX: projectTemplate.tiltX, tiltY: projectTemplate.tiltY, clipTlx: projectTemplate.clipTlx, clipTly: projectTemplate.clipTly, clipTrx: projectTemplate.clipTrx, clipTry: projectTemplate.clipTry, clipBrx: projectTemplate.clipBrx, clipBry: projectTemplate.clipBry, clipBlx: projectTemplate.clipBlx, clipBly: projectTemplate.clipBly });
    });
    if (saved[globalDeskTemplate_1.FOLDER_TEMPLATE_ID])
        next[globalDeskTemplate_1.FOLDER_TEMPLATE_ID] = saved[globalDeskTemplate_1.FOLDER_TEMPLATE_ID];
    if (saved[globalDeskTemplate_1.PROJECT_TEMPLATE_ID])
        next[globalDeskTemplate_1.PROJECT_TEMPLATE_ID] = saved[globalDeskTemplate_1.PROJECT_TEMPLATE_ID];
    return next;
}
function DashboardPage() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    var _v = (0, useSession_1.useSession)(), session = _v.session, user = _v.user, sessionLoading = _v.loading;
    var router = (0, router_1.useRouter)();
    var _w = (0, react_1.useState)(null), data = _w[0], setData = _w[1];
    var _x = (0, react_1.useState)(null), workspace = _x[0], setWorkspace = _x[1];
    var _y = (0, react_1.useState)(false), loading = _y[0], setLoading = _y[1];
    var _z = (0, react_1.useState)(""), error = _z[0], setError = _z[1];
    var _0 = (0, react_1.useState)(""), newFolderName = _0[0], setNewFolderName = _0[1];
    var _1 = (0, react_1.useState)("folder"), newFolderIcon = _1[0], setNewFolderIcon = _1[1];
    var _2 = (0, react_1.useState)(null), draggingProjectId = _2[0], setDraggingProjectId = _2[1];
    var _3 = (0, react_1.useState)(null), busyFolderId = _3[0], setBusyFolderId = _3[1];
    var _4 = (0, react_1.useState)(null), activeFolderId = _4[0], setActiveFolderId = _4[1];
    var _5 = (0, react_1.useState)(null), iconPickerFolder = _5[0], setIconPickerFolder = _5[1];
    var _6 = (0, react_1.useState)(null), folderActionTarget = _6[0], setFolderActionTarget = _6[1];
    var _7 = (0, react_1.useState)(null), folderRenameTarget = _7[0], setFolderRenameTarget = _7[1];
    var _8 = (0, react_1.useState)(""), folderRenameValue = _8[0], setFolderRenameValue = _8[1];
    var _9 = (0, react_1.useState)(null), folderDeleteTarget = _9[0], setFolderDeleteTarget = _9[1];
    var _10 = (0, react_1.useState)(false), showCreateFolder = _10[0], setShowCreateFolder = _10[1];
    var _11 = (0, useWallet_1.useWallet)(), wallet = _11.wallet, ledger = _11.ledger, walletLoading = _11.loading, isUnlimited = _11.isUnlimited;
    var isAdmin = (0, admin_1.isAdminEmail)(user === null || user === void 0 ? void 0 : user.email);
    var _12 = (0, react_1.useState)(0), mechanicPulse = _12[0], setMechanicPulse = _12[1];
    var _13 = (0, react_1.useState)({}), deskPositions = _13[0], setDeskPositions = _13[1];
    var _14 = (0, react_1.useState)(300), deskLayer = _14[0], setDeskLayer = _14[1];
    var _15 = (0, react_1.useState)(null), previewProject = _15[0], setPreviewProject = _15[1];
    var _16 = (0, react_1.useState)(null), draggingFolderId = _16[0], setDraggingFolderId = _16[1];
    var _17 = (0, react_1.useState)(null), trashHover = _17[0], setTrashHover = _17[1];
    var trashHoverTimer = (0, react_1.useRef)(null);
    var _18 = (0, react_1.useState)([]), trashEntries = _18[0], setTrashEntries = _18[1];
    var _19 = (0, react_1.useState)(false), trashOpen = _19[0], setTrashOpen = _19[1];
    var canEditScene = (user === null || user === void 0 ? void 0 : user.email) === "storyguild9@gmail.com" || isAdmin;
    var _20 = (0, react_1.useState)(false), sceneEditMode = _20[0], setSceneEditMode = _20[1];
    var _21 = (0, react_1.useState)([]), sceneWidgets = _21[0], setSceneWidgets = _21[1];
    var _22 = (0, react_1.useState)("scheme"), desktopVariant = _22[0], setDesktopVariant = _22[1];
    var _23 = (0, react_1.useState)("Создать новую папку проектов"), trayGuideText = _23[0], setTrayGuideText = _23[1];
    var _24 = (0, react_1.useState)(null), selectedWidgetId = _24[0], setSelectedWidgetId = _24[1];
    var _25 = (0, react_1.useState)(null), selectedDeskItemId = _25[0], setSelectedDeskItemId = _25[1];
    var widgetInteractionRef = (0, react_1.useRef)(null);
    var deskInteractionRef = (0, react_1.useRef)(null);
    var pendingCreatedFolderRef = (0, react_1.useRef)(null);
    var templateFeedbackTimerRef = (0, react_1.useRef)(null);
    var _26 = (0, react_1.useState)(null), templateFeedback = _26[0], setTemplateFeedback = _26[1];
    var _27 = (0, react_1.useState)({}), sharedDeskPositions = _27[0], setSharedDeskPositions = _27[1];
    var _28 = (0, react_1.useState)([]), sharedSceneWidgets = _28[0], setSharedSceneWidgets = _28[1];
    var _29 = (0, react_1.useState)(""), sharedTrayGuideText = _29[0], setSharedTrayGuideText = _29[1];
    var _30 = (0, react_1.useState)(false), sharedSceneReady = _30[0], setSharedSceneReady = _30[1];
    var balance_rub = (0, react_1.useMemo)(function () {
        var _a;
        if (isUnlimited)
            return 999999;
        return Math.floor(Number((_a = wallet === null || wallet === void 0 ? void 0 : wallet.balance_kopeks) !== null && _a !== void 0 ? _a : 0) / 100);
    }, [isUnlimited, wallet === null || wallet === void 0 ? void 0 : wallet.balance_kopeks]);
    var investedRub = (0, react_1.useMemo)(function () {
        if (isUnlimited)
            return 10000;
        var creditedKopeks = ledger.reduce(function (sum, item) {
            var _a;
            var amount = Number((_a = item === null || item === void 0 ? void 0 : item.amount_kopeks) !== null && _a !== void 0 ? _a : 0);
            return amount > 0 ? sum + amount : sum;
        }, 0);
        var fromLedger = Math.floor(creditedKopeks / 100);
        return Math.max(fromLedger, balance_rub, 0);
    }, [balance_rub, isUnlimited, ledger]);
    var greeneryLevel = (0, react_1.useMemo)(function () { return getGreeneryLevel(investedRub, isUnlimited); }, [investedRub, isUnlimited]);
    var greeneryLabel = (0, react_1.useMemo)(function () { return getGreeneryLabel(greeneryLevel); }, [greeneryLevel]);
    var greeneryHint = (0, react_1.useMemo)(function () { return getGreeneryHint(greeneryLevel); }, [greeneryLevel]);
    var balanceText = walletLoading ? "…" : isUnlimited ? "∞" : "".concat(balance_rub, " \u20BD");
    var investedText = isUnlimited ? "без лимита" : "".concat(investedRub, " \u20BD");
    var triggerMechanics = (0, react_1.useCallback)(function (after, delay) {
        if (delay === void 0) { delay = 220; }
        setMechanicPulse(function (value) { return value + 1; });
        if (after) {
            window.setTimeout(function () {
                after();
            }, delay);
        }
    }, []);
    var loadDashboard = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, profileResp, workspaceResp, sharedTemplatesResp, profileJson, workspaceJson, sharedTemplatesJson, parsedStandard, nextSharedPositions, nextSharedWidgets, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!session)
                        return [2 /*return*/];
                    setLoading(true);
                    setError("");
                    setSharedSceneReady(false);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    return [4 /*yield*/, Promise.all([
                            fetch("/api/commercial/profile/me", {
                                headers: { authorization: "Bearer ".concat(session.access_token) },
                            }),
                            fetch("/api/commercial/projects/list", {
                                headers: { authorization: "Bearer ".concat(session.access_token) },
                            }),
                            fetch("/api/commercial/scene-template", {
                                headers: { authorization: "Bearer ".concat(session.access_token) },
                            }),
                        ])];
                case 2:
                    _a = _b.sent(), profileResp = _a[0], workspaceResp = _a[1], sharedTemplatesResp = _a[2];
                    return [4 /*yield*/, profileResp.json().catch(function () { return ({}); })];
                case 3:
                    profileJson = _b.sent();
                    return [4 /*yield*/, workspaceResp.json().catch(function () { return ({}); })];
                case 4:
                    workspaceJson = _b.sent();
                    return [4 /*yield*/, sharedTemplatesResp.json().catch(function () { return ({}); })];
                case 5:
                    sharedTemplatesJson = _b.sent();
                    if (!profileResp.ok || !(profileJson === null || profileJson === void 0 ? void 0 : profileJson.ok))
                        throw new Error((profileJson === null || profileJson === void 0 ? void 0 : profileJson.error) || "Не удалось загрузить кабинет");
                    if (!workspaceResp.ok || !(workspaceJson === null || workspaceJson === void 0 ? void 0 : workspaceJson.ok))
                        throw new Error((workspaceJson === null || workspaceJson === void 0 ? void 0 : workspaceJson.error) || "Не удалось загрузить проекты");
                    if (sharedTemplatesResp.ok && (sharedTemplatesJson === null || sharedTemplatesJson === void 0 ? void 0 : sharedTemplatesJson.ok)) {
                        parsedStandard = (0, globalDeskTemplate_1.pickSceneStandard)((sharedTemplatesJson === null || sharedTemplatesJson === void 0 ? void 0 : sharedTemplatesJson.standard) || sharedTemplatesJson || {});
                        nextSharedPositions = (parsedStandard.positions || {});
                        nextSharedWidgets = (parsedStandard.widgets || []);
                        setSharedDeskPositions(nextSharedPositions);
                        setSharedSceneWidgets(nextSharedWidgets);
                        setSharedTrayGuideText(parsedStandard.trayGuideText || "");
                        writeGlobalDeskTemplates(nextSharedPositions);
                    }
                    else {
                        setSharedDeskPositions({});
                        setSharedSceneWidgets([]);
                        setSharedTrayGuideText("");
                    }
                    setSharedSceneReady(true);
                    setData(profileJson);
                    setWorkspace(workspaceJson);
                    return [3 /*break*/, 8];
                case 6:
                    e_1 = _b.sent();
                    setSharedDeskPositions({});
                    setSharedSceneWidgets([]);
                    setSharedTrayGuideText("");
                    setSharedSceneReady(true);
                    setError((e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || "Ошибка");
                    return [3 /*break*/, 8];
                case 7:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [session, user === null || user === void 0 ? void 0 : user.email]);
    (0, react_1.useEffect)(function () {
        if (sessionLoading)
            return;
        if (!session || !user) {
            router.replace("/auth?next=%2Fdashboard");
            return;
        }
        loadDashboard();
    }, [router, session, sessionLoading, user, loadDashboard]);
    var displayName = ((_a = data === null || data === void 0 ? void 0 : data.profile) === null || _a === void 0 ? void 0 : _a.full_name) || ((_b = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _b === void 0 ? void 0 : _b.full_name) || (user === null || user === void 0 ? void 0 : user.email) || "Пользователь";
    var workspaceName = ((_c = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _c === void 0 ? void 0 : _c.name) || ((_d = data === null || data === void 0 ? void 0 : data.profile) === null || _d === void 0 ? void 0 : _d.company_name) || ((_e = user === null || user === void 0 ? void 0 : user.user_metadata) === null || _e === void 0 ? void 0 : _e.company_name) || "Рабочее пространство";
    var defaultSceneWidgets = (0, react_1.useMemo)(function () {
        var _a;
        return (desktopVariant === "classic" ? buildClassicSceneWidgets : buildSchemeSceneWidgets)({
            displayName: displayName,
            workspaceName: workspaceName,
            email: ((_a = data === null || data === void 0 ? void 0 : data.profile) === null || _a === void 0 ? void 0 : _a.email) || (user === null || user === void 0 ? void 0 : user.email) || "email не указан",
            balanceText: balanceText,
            investedText: investedText,
            greeneryLabel: greeneryLabel,
        });
    }, [balanceText, (_f = data === null || data === void 0 ? void 0 : data.profile) === null || _f === void 0 ? void 0 : _f.email, desktopVariant, displayName, greeneryLabel, investedText, user === null || user === void 0 ? void 0 : user.email, workspaceName]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || typeof window === "undefined")
            return;
        try {
            var raw = window.localStorage.getItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id));
            if (raw === "classic" || raw === "scheme")
                setDesktopVariant(raw);
        }
        catch (_b) { }
    }, [(_g = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _g === void 0 ? void 0 : _g.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || typeof window === "undefined")
            return;
        try {
            window.localStorage.setItem(getDesktopVariantStorageKey(workspace.workspace.workspace_id), desktopVariant);
        }
        catch (_b) { }
    }, [desktopVariant, (_h = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _h === void 0 ? void 0 : _h.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady)
            return;
        var key = getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant);
        var saved = [];
        if (typeof window !== "undefined") {
            try {
                var raw = window.localStorage.getItem(key);
                if (raw)
                    saved = JSON.parse(raw);
                if (!raw && desktopVariant === "scheme") {
                    var legacyRaw = window.localStorage.getItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id));
                    if (legacyRaw)
                        saved = JSON.parse(legacyRaw);
                }
            }
            catch (_b) {
                saved = [];
            }
        }
        var allowedIds = new Set(defaultSceneWidgets.map(function (item) { return item.id; }));
        var defaultsById = new Map(defaultSceneWidgets.map(function (item) { return [item.id, item]; }));
        var sourceWidgets = [];
        if (desktopVariant === "classic") {
            sourceWidgets = saved.length ? saved : defaultSceneWidgets;
        }
        else {
            var legacyWidgetIds_1 = new Set([
                "wallet-title",
                "wallet-value",
                "wallet-note",
                "profile-title",
                "profile-name",
                "profile-role",
                "profile-email",
                "create-folder",
            ]);
            var hasLegacyBoardLayout = saved.some(function (item) { return legacyWidgetIds_1.has(item.id); });
            var hasMarkerScheme = saved.some(function (item) { return item.id === "board-scheme"; }) || sharedSceneWidgets.some(function (item) { return item.id === "board-scheme"; });
            var needsMarkerSceneUpgrade = !hasLegacyBoardLayout && !hasMarkerScheme;
            sourceWidgets = hasLegacyBoardLayout || needsMarkerSceneUpgrade
                ? (sharedSceneWidgets.some(function (item) { return item.id === "board-scheme"; }) ? sharedSceneWidgets : defaultSceneWidgets)
                : (saved.length ? saved : (sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets));
        }
        var normalizedWidgets = sourceWidgets
            .filter(function (item) { return allowedIds.has(item.id); })
            .map(function (item) {
            var defaults = defaultsById.get(item.id);
            if (!defaults)
                return item;
            return __assign(__assign({}, item), { text: defaults.text, action: defaults.action, kind: defaults.kind, tone: defaults.tone, src: item.src || defaults.src });
        });
        var _loop_1 = function (defaults) {
            if (!normalizedWidgets.some(function (item) { return item.id === defaults.id; }))
                normalizedWidgets.push(__assign({}, defaults));
        };
        for (var _i = 0, defaultSceneWidgets_1 = defaultSceneWidgets; _i < defaultSceneWidgets_1.length; _i++) {
            var defaults = defaultSceneWidgets_1[_i];
            _loop_1(defaults);
        }
        normalizedWidgets.sort(function (a, b) { return a.z - b.z; });
        setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
    }, [defaultSceneWidgets, desktopVariant, sharedSceneReady, sharedSceneWidgets, (_j = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _j === void 0 ? void 0 : _j.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady || typeof window === "undefined" || !sceneWidgets.length)
            return;
        window.localStorage.setItem(getSceneWidgetsStorageKey(workspace.workspace.workspace_id, desktopVariant), JSON.stringify(sceneWidgets));
    }, [desktopVariant, sceneWidgets, sharedSceneReady, (_k = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _k === void 0 ? void 0 : _k.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady || typeof window === "undefined")
            return;
        try {
            var raw = window.localStorage.getItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id));
            if (raw && raw.trim())
                setTrayGuideText(raw);
            else if (sharedTrayGuideText)
                setTrayGuideText(sharedTrayGuideText);
            else
                setTrayGuideText("Создать новую папку проектов");
        }
        catch (_b) {
            setTrayGuideText(sharedTrayGuideText || "Создать новую папку проектов");
        }
    }, [sharedSceneReady, sharedTrayGuideText, (_l = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _l === void 0 ? void 0 : _l.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady || typeof window === "undefined")
            return;
        window.localStorage.setItem(getTrayGuideTextStorageKey(workspace.workspace.workspace_id), trayGuideText);
    }, [sharedSceneReady, trayGuideText, (_m = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _m === void 0 ? void 0 : _m.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || typeof window === "undefined")
            return;
        try {
            var raw = window.localStorage.getItem(getTrashStorageKey(workspace.workspace.workspace_id));
            var parsed = raw ? JSON.parse(raw) : [];
            var now_1 = Date.now();
            setTrashEntries(parsed.filter(function (item) { return item.expiresAt > now_1; }));
        }
        catch (_b) {
            setTrashEntries([]);
        }
    }, [(_o = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _o === void 0 ? void 0 : _o.workspace_id]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || typeof window === "undefined")
            return;
        window.localStorage.setItem(getTrashStorageKey(workspace.workspace.workspace_id), JSON.stringify(trashEntries));
    }, [trashEntries, (_p = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _p === void 0 ? void 0 : _p.workspace_id]);
    var selectedWidget = (0, react_1.useMemo)(function () { return sceneWidgets.find(function (item) { return item.id === selectedWidgetId; }) || null; }, [sceneWidgets, selectedWidgetId]);
    var updateSceneWidget = (0, react_1.useCallback)(function (id, patch) {
        setSceneWidgets(function (prev) { return prev.map(function (item) { return (item.id === id ? __assign(__assign({}, item), patch) : item); }); });
    }, []);
    var updateDeskItem = (0, react_1.useCallback)(function (id, patch) {
        setDeskPositions(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[id] = __assign(__assign({}, (prev[id] || { x: 48, y: 48, z: deskLayer + 1 })), patch), _a)));
        });
    }, [deskLayer]);
    var showTemplateFeedback = (0, react_1.useCallback)(function (kind, text) {
        setTemplateFeedback({ kind: kind, text: text });
        if (typeof window !== "undefined") {
            if (templateFeedbackTimerRef.current)
                window.clearTimeout(templateFeedbackTimerRef.current);
            templateFeedbackTimerRef.current = window.setTimeout(function () { return setTemplateFeedback(null); }, 2200);
        }
    }, []);
    (0, react_1.useEffect)(function () { return function () {
        if (typeof window !== "undefined" && templateFeedbackTimerRef.current) {
            window.clearTimeout(templateFeedbackTimerRef.current);
        }
    }; }, []);
    var saveDeskItemAsTemplate = (0, react_1.useCallback)(function (itemId, kind) { return __awaiter(_this, void 0, void 0, function () {
        var source, templateId, templatePatch, nextDeskPositions, standardPayload, resp, json, parsedStandard, sharedPositions, sharedWidgets, e_2;
        var _a, _b, _c;
        var _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    source = deskPositions[itemId];
                    if (!source) {
                        showTemplateFeedback("error", "Не удалось найти объект для сохранения стандарта");
                        return [2 /*return*/];
                    }
                    templateId = kind === "folder" ? globalDeskTemplate_1.FOLDER_TEMPLATE_ID : globalDeskTemplate_1.PROJECT_TEMPLATE_ID;
                    templatePatch = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ x: ((_f = (_e = (_d = deskPositions[templateId]) === null || _d === void 0 ? void 0 : _d.x) !== null && _e !== void 0 ? _e : source.x) !== null && _f !== void 0 ? _f : 0), y: ((_j = (_h = (_g = deskPositions[templateId]) === null || _g === void 0 ? void 0 : _g.y) !== null && _h !== void 0 ? _h : source.y) !== null && _j !== void 0 ? _j : 0), z: ((_m = (_l = (_k = deskPositions[templateId]) === null || _k === void 0 ? void 0 : _k.z) !== null && _l !== void 0 ? _l : source.z) !== null && _m !== void 0 ? _m : 0) }, (source.width !== undefined ? { width: source.width } : {})), (source.height !== undefined ? { height: source.height } : {})), (source.rotation !== undefined ? { rotation: source.rotation } : {})), (source.tiltX !== undefined ? { tiltX: source.tiltX } : {})), (source.tiltY !== undefined ? { tiltY: source.tiltY } : {})), (source.clipTlx !== undefined ? { clipTlx: source.clipTlx } : {})), (source.clipTly !== undefined ? { clipTly: source.clipTly } : {})), (source.clipTrx !== undefined ? { clipTrx: source.clipTrx } : {})), (source.clipTry !== undefined ? { clipTry: source.clipTry } : {})), (source.clipBrx !== undefined ? { clipBrx: source.clipBrx } : {})), (source.clipBry !== undefined ? { clipBry: source.clipBry } : {})), (source.clipBlx !== undefined ? { clipBlx: source.clipBlx } : {})), (source.clipBly !== undefined ? { clipBly: source.clipBly } : {}));
                    nextDeskPositions = __assign(__assign({}, deskPositions), (_a = {}, _a[templateId] = __assign(__assign({}, (deskPositions[templateId] || {})), templatePatch), _a));
                    setDeskPositions(nextDeskPositions);
                    writeGlobalDeskTemplates(nextDeskPositions);
                    if (!(session === null || session === void 0 ? void 0 : session.access_token) || !isAdmin) {
                        showTemplateFeedback("success", "\u0428\u0430\u0431\u043B\u043E\u043D ".concat(kind === "folder" ? "папок" : "листов", " \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E"));
                        return [2 /*return*/];
                    }
                    standardPayload = {
                        positions: __assign(__assign(__assign({}, (0, globalDeskTemplate_1.pickTemplatePositions)(nextDeskPositions)), (nextDeskPositions[TRAY_GUIDE_ID] ? (_b = {}, _b[TRAY_GUIDE_ID] = nextDeskPositions[TRAY_GUIDE_ID], _b) : {})), (nextDeskPositions[TRASH_GUIDE_ID] ? (_c = {}, _c[TRASH_GUIDE_ID] = nextDeskPositions[TRASH_GUIDE_ID], _c) : {})),
                        widgets: sceneWidgets.map(function (item) { return ({
                            id: item.id,
                            kind: item.kind,
                            text: item.text,
                            action: item.action,
                            tone: item.tone,
                            x: item.x,
                            y: item.y,
                            width: item.width,
                            height: item.height,
                            rotation: item.rotation,
                            fontSize: item.fontSize,
                            z: item.z,
                        }); }),
                        trayGuideText: trayGuideText,
                    };
                    _o.label = 1;
                case 1:
                    _o.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("/api/commercial/scene-template", {
                            method: "POST",
                            headers: {
                                "content-type": "application/json",
                                authorization: "Bearer ".concat(session.access_token),
                            },
                            body: JSON.stringify({
                                standard: standardPayload,
                                positions: standardPayload.positions,
                                widgets: standardPayload.widgets,
                                trayGuideText: standardPayload.trayGuideText,
                                templates: (0, globalDeskTemplate_1.pickTemplatePositions)(nextDeskPositions),
                            }),
                        })];
                case 2:
                    resp = _o.sent();
                    return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                case 3:
                    json = _o.sent();
                    if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok)) {
                        throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось сохранить общий стандарт");
                    }
                    parsedStandard = (0, globalDeskTemplate_1.pickSceneStandard)((json === null || json === void 0 ? void 0 : json.standard) || json || {});
                    sharedPositions = (parsedStandard.positions || {});
                    sharedWidgets = (parsedStandard.widgets || []);
                    setSharedDeskPositions(sharedPositions);
                    setSharedSceneWidgets(sharedWidgets);
                    setSharedTrayGuideText(parsedStandard.trayGuideText || "");
                    writeGlobalDeskTemplates(sharedPositions);
                    showTemplateFeedback("success", "\u0421\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043E\u0431\u0449\u0438\u0439 \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442 \u0441\u0446\u0435\u043D\u044B: ".concat(kind === "folder" ? "папки" : "листы", ", \u0441\u0442\u043E\u0439\u043A\u0430 \u0438 \u043A\u043D\u043E\u043F\u043A\u0438"));
                    return [3 /*break*/, 5];
                case 4:
                    e_2 = _o.sent();
                    showTemplateFeedback("error", (e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || "Не удалось сохранить общий стандарт");
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [deskPositions, isAdmin, sceneWidgets, session === null || session === void 0 ? void 0 : session.access_token, showTemplateFeedback, trayGuideText]);
    var applyDeskTemplateToExistingItems = (0, react_1.useCallback)(function (kind) {
        var templateId = kind === "folder" ? globalDeskTemplate_1.FOLDER_TEMPLATE_ID : globalDeskTemplate_1.PROJECT_TEMPLATE_ID;
        var template = deskPositions[templateId];
        if (!template) {
            showTemplateFeedback("error", "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u0448\u0430\u0431\u043B\u043E\u043D \u0434\u043B\u044F ".concat(kind === "folder" ? "папок" : "листов"));
            return;
        }
        var prefix = kind === "folder" ? "folder:" : "project:";
        var targetIds = Object.keys(deskPositions).filter(function (key) { return key.startsWith(prefix); });
        if (!targetIds.length) {
            showTemplateFeedback("error", "\u041D\u0435\u0442 \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0434\u043B\u044F \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0448\u0430\u0431\u043B\u043E\u043D\u0430");
            return;
        }
        setDeskPositions(function (prev) {
            var next = __assign({}, prev);
            targetIds.forEach(function (key) {
                next[key] = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, prev[key]), (template.width !== undefined ? { width: template.width } : {})), (template.height !== undefined ? { height: template.height } : {})), (template.rotation !== undefined ? { rotation: template.rotation } : {})), (template.tiltX !== undefined ? { tiltX: template.tiltX } : {})), (template.tiltY !== undefined ? { tiltY: template.tiltY } : {})), (template.clipTlx !== undefined ? { clipTlx: template.clipTlx } : {})), (template.clipTly !== undefined ? { clipTly: template.clipTly } : {})), (template.clipTrx !== undefined ? { clipTrx: template.clipTrx } : {})), (template.clipTry !== undefined ? { clipTry: template.clipTry } : {})), (template.clipBrx !== undefined ? { clipBrx: template.clipBrx } : {})), (template.clipBry !== undefined ? { clipBry: template.clipBry } : {})), (template.clipBlx !== undefined ? { clipBlx: template.clipBlx } : {})), (template.clipBly !== undefined ? { clipBly: template.clipBly } : {}));
            });
            return next;
        });
        showTemplateFeedback("success", "\u0428\u0430\u0431\u043B\u043E\u043D \u043F\u0440\u0438\u043C\u0435\u043D\u0451\u043D: ".concat(targetIds.length, " ").concat(kind === "folder" ? "объектов-папок" : "объектов-листов"));
    }, [deskPositions, showTemplateFeedback]);
    var moveToTrash = (0, react_1.useCallback)(function (kind, id, title) {
        var now = Date.now();
        setTrashEntries(function (prev) {
            var next = prev.filter(function (item) { return !(item.kind === kind && item.id === id); });
            next.unshift({ kind: kind, id: id, title: title, deletedAt: now, expiresAt: now + TRASH_RETENTION_MS });
            return next;
        });
        setActiveFolderId(function (current) { return (kind === "folder" && current === id ? null : current); });
        setPreviewProject(function (current) { return (kind === "project" && (current === null || current === void 0 ? void 0 : current.id) === id ? null : current); });
    }, []);
    var restoreTrashEntry = (0, react_1.useCallback)(function (entry) {
        setTrashEntries(function (prev) { return prev.filter(function (item) { return !(item.kind === entry.kind && item.id === entry.id); }); });
    }, []);
    var handleSceneWidgetAction = (0, react_1.useCallback)(function (action) {
        if (action === "createProject") {
            router.push('/projects/new');
            return;
        }
        if (action === "openCatalog") {
            router.push('/assessments');
            return;
        }
        if (action === "createFolder") {
            promptAndCreateFolder();
            return;
        }
    }, [router, session, newFolderIcon, loadDashboard]);
    var startWidgetInteraction = (0, react_1.useCallback)(function (e, widget, mode) {
        if (!sceneEditMode || !canEditScene)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedWidgetId(widget.id);
        widgetInteractionRef.current = { id: widget.id, mode: mode, startX: e.clientX, startY: e.clientY, widget: __assign({}, widget) };
    }, [canEditScene, sceneEditMode]);
    (0, react_1.useEffect)(function () {
        if (!sceneEditMode)
            return;
        var handleMove = function (e) {
            var current = widgetInteractionRef.current;
            if (!current)
                return;
            var dx = e.clientX - current.startX;
            var dy = e.clientY - current.startY;
            if (current.mode === "drag") {
                updateSceneWidget(current.id, {
                    x: clampDesk(current.widget.x + dx, 40, DESK_WIDTH - current.widget.width - 40),
                    y: clampDesk(current.widget.y + dy, 40, DESK_HEIGHT - current.widget.height - 40),
                });
                return;
            }
            if (current.mode === "resize") {
                var isImageWidget = current.widget.kind === "image";
                updateSceneWidget(current.id, {
                    width: clampDesk(current.widget.width + dx, isImageWidget ? 280 : 110, isImageWidget ? DESK_WIDTH - 20 : 520),
                    height: clampDesk(current.widget.height + dy, isImageWidget ? 180 : 30, isImageWidget ? DESK_HEIGHT - 10 : 180),
                });
                return;
            }
            updateSceneWidget(current.id, { rotation: current.widget.rotation + dx * 0.18 });
        };
        var handleUp = function () {
            widgetInteractionRef.current = null;
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return function () {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [sceneEditMode, updateSceneWidget]);
    var startDeskItemInteraction = (0, react_1.useCallback)(function (e, itemId, kind, mode, position) {
        if (!sceneEditMode || !canEditScene)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedDeskItemId(itemId);
        deskInteractionRef.current = { id: itemId, kind: kind, mode: mode, startX: e.clientX, startY: e.clientY, position: __assign({}, position) };
    }, [canEditScene, sceneEditMode]);
    (0, react_1.useEffect)(function () {
        if (!sceneEditMode)
            return;
        var handleMove = function (e) {
            var _a, _b, _c, _d, _e, _f, _g;
            var current = deskInteractionRef.current;
            if (!current)
                return;
            var dx = e.clientX - current.startX;
            var dy = e.clientY - current.startY;
            var isFolder = current.kind === "folder";
            var isGuide = current.kind === "guide";
            var defaultWidth = isGuide ? ((_a = current.position.width) !== null && _a !== void 0 ? _a : 228) : isFolder ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH;
            var defaultHeight = isGuide ? ((_b = current.position.height) !== null && _b !== void 0 ? _b : 104) : isFolder ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT;
            var baseWidth = (_c = current.position.width) !== null && _c !== void 0 ? _c : defaultWidth;
            var baseHeight = (_d = current.position.height) !== null && _d !== void 0 ? _d : defaultHeight;
            if (current.mode === "drag") {
                var minX = current.kind === "project" ? -baseWidth * 0.5 : 0;
                var minY = current.kind === "project" ? -baseHeight * 0.5 : 0;
                var maxX = current.kind === "project" ? DESK_WIDTH - baseWidth * 0.5 : DESK_WIDTH - baseWidth;
                var maxY = current.kind === "project" ? DESK_HEIGHT - baseHeight * 0.5 : DESK_HEIGHT - baseHeight;
                updateDeskItem(current.id, {
                    x: clampDesk(((_e = current.position.x) !== null && _e !== void 0 ? _e : 0) + dx, minX, maxX),
                    y: clampDesk(((_f = current.position.y) !== null && _f !== void 0 ? _f : 0) + dy, minY, maxY),
                });
                return;
            }
            if (current.mode === "resize") {
                updateDeskItem(current.id, {
                    width: clampDesk(baseWidth + dx, isGuide ? 120 : isFolder ? 120 : 140, isGuide ? 420 : isFolder ? 280 : 320),
                    height: clampDesk(baseHeight + dy, isGuide ? 48 : isFolder ? 100 : 110, isGuide ? 220 : isFolder ? 260 : 320),
                });
                return;
            }
            updateDeskItem(current.id, { rotation: ((_g = current.position.rotation) !== null && _g !== void 0 ? _g : 0) + dx * 0.18 });
        };
        var handleUp = function () {
            deskInteractionRef.current = null;
        };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return function () {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [sceneEditMode, updateDeskItem]);
    var trashedProjectIds = (0, react_1.useMemo)(function () { return new Set(trashEntries.filter(function (item) { return item.kind === "project"; }).map(function (item) { return item.id; })); }, [trashEntries]);
    var trashedFolderIds = (0, react_1.useMemo)(function () { return new Set(trashEntries.filter(function (item) { return item.kind === "folder"; }).map(function (item) { return item.id; })); }, [trashEntries]);
    var projects = (0, react_1.useMemo)(function () { return ((workspace === null || workspace === void 0 ? void 0 : workspace.projects) || []).filter(function (item) { return !trashedProjectIds.has(item.id); }); }, [trashedProjectIds, workspace === null || workspace === void 0 ? void 0 : workspace.projects]);
    var folders = (0, react_1.useMemo)(function () { return ((workspace === null || workspace === void 0 ? void 0 : workspace.folders) || []).filter(function (item) { return !trashedFolderIds.has(item.id); }); }, [trashedFolderIds, workspace === null || workspace === void 0 ? void 0 : workspace.folders]);
    var folderBuckets = (0, react_1.useMemo)(function () {
        var buckets = new Map();
        for (var _i = 0, folders_1 = folders; _i < folders_1.length; _i++) {
            var folder = folders_1[_i];
            buckets.set(folder.id, []);
        }
        var uncategorized = [];
        for (var _a = 0, projects_1 = projects; _a < projects_1.length; _a++) {
            var project = projects_1[_a];
            if (project.folder_id && buckets.has(project.folder_id)) {
                buckets.get(project.folder_id).push(project);
            }
            else {
                uncategorized.push(project);
            }
        }
        return {
            uncategorized: sortProjects(uncategorized),
            byFolder: folders.map(function (folder) { return ({ folder: folder, projects: sortProjects(buckets.get(folder.id) || []) }); }),
        };
    }, [folders, projects]);
    var resetSceneWidgets = (0, react_1.useCallback)(function () {
        var _a;
        var workspaceId = (_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id;
        if (workspaceId && typeof window !== "undefined") {
            window.localStorage.removeItem(getSceneWidgetsStorageKey(workspaceId, desktopVariant));
            window.localStorage.removeItem(getTrayGuideTextStorageKey(workspaceId));
            window.localStorage.removeItem(getDeskStorageKey(workspaceId));
        }
        var allowedIds = new Set(defaultSceneWidgets.map(function (item) { return item.id; }));
        var defaultsById = new Map(defaultSceneWidgets.map(function (item) { return [item.id, item]; }));
        var baseWidgets = desktopVariant === "scheme" && sharedSceneWidgets.length ? sharedSceneWidgets : defaultSceneWidgets;
        var normalizedWidgets = baseWidgets
            .filter(function (item) { return allowedIds.has(item.id); })
            .map(function (item) {
            var defaults = defaultsById.get(item.id);
            if (!defaults)
                return item;
            return __assign(__assign({}, item), { text: defaults.text, action: defaults.action, kind: defaults.kind, tone: defaults.tone });
        })
            .sort(function (a, b) { return a.z - b.z; });
        setSceneWidgets(normalizedWidgets.length ? normalizedWidgets : defaultSceneWidgets);
        setTrayGuideText(sharedTrayGuideText || "Создать новую папку проектов");
        setDeskPositions(mergeDeskPositions(folders, folderBuckets.uncategorized, __assign(__assign({}, sharedDeskPositions), readGlobalDeskTemplates())));
        setSelectedWidgetId(null);
        setSelectedDeskItemId(null);
    }, [defaultSceneWidgets, desktopVariant, folderBuckets.uncategorized, folders, sharedDeskPositions, sharedSceneWidgets, sharedTrayGuideText, (_q = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _q === void 0 ? void 0 : _q.workspace_id]);
    var activeFolder = (0, react_1.useMemo)(function () { return folderBuckets.byFolder.find(function (item) { return item.folder.id === activeFolderId; }) || null; }, [activeFolderId, folderBuckets.byFolder]);
    var totalAttempts = (0, react_1.useMemo)(function () { return projects.reduce(function (sum, item) { return sum + (item.attempts_count || 0); }, 0); }, [projects]);
    var selectedDeskItem = (0, react_1.useMemo)(function () {
        var _a;
        if (!selectedDeskItemId)
            return null;
        if (selectedDeskItemId === TRAY_GUIDE_ID) {
            return { kind: "guide", id: selectedDeskItemId, title: "Виртуальная стойка", position: deskPositions[selectedDeskItemId] || getDefaultTrayGuidePosition() };
        }
        if (selectedDeskItemId === TRASH_GUIDE_ID) {
            return { kind: "guide", id: selectedDeskItemId, title: "Виртуальная зона корзины", position: deskPositions[selectedDeskItemId] || getDefaultTrashGuidePosition() };
        }
        if (selectedDeskItemId.startsWith("folder:")) {
            var id_1 = selectedDeskItemId.replace("folder:", "");
            var folder = folders.find(function (item) { return item.id === id_1; });
            if (!folder)
                return null;
            return { kind: "folder", id: selectedDeskItemId, title: folder.name, position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
        }
        if (selectedDeskItemId.startsWith("project:")) {
            var id_2 = selectedDeskItemId.replace("project:", "");
            var project = projects.find(function (item) { return item.id === id_2; });
            if (!project)
                return null;
            return { kind: "project", id: selectedDeskItemId, title: project.title || ((_a = project.person) === null || _a === void 0 ? void 0 : _a.full_name) || "Проект", position: deskPositions[selectedDeskItemId] || { x: 0, y: 0, z: 0 } };
        }
        return null;
    }, [deskPositions, folders, projects, selectedDeskItemId]);
    (0, react_1.useEffect)(function () {
        if (!activeFolderId)
            return;
        var stillExists = folderBuckets.byFolder.some(function (item) { return item.folder.id === activeFolderId; });
        if (!stillExists)
            setActiveFolderId(null);
    }, [activeFolderId, folderBuckets.byFolder]);
    (0, react_1.useEffect)(function () {
        if (!previewProject)
            return;
        var stillExists = projects.some(function (item) { return item.id === previewProject.id; });
        if (!stillExists)
            setPreviewProject(null);
    }, [previewProject, projects]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady)
            return;
        var saved = typeof window !== "undefined"
            ? (function () {
                try {
                    var raw = window.localStorage.getItem(getDeskStorageKey(workspace.workspace.workspace_id));
                    return raw ? JSON.parse(raw) : {};
                }
                catch (_a) {
                    return {};
                }
            })()
            : {};
        var globalTemplates = readGlobalDeskTemplates();
        setDeskPositions(function (current) {
            var merged = mergeDeskPositions(folders, folderBuckets.uncategorized, __assign(__assign(__assign(__assign({}, sharedDeskPositions), globalTemplates), saved), current));
            setDeskLayer(Object.values(merged).reduce(function (max, item) { return Math.max(max, item.z || 0); }, 300));
            return merged;
        });
    }, [(_r = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _r === void 0 ? void 0 : _r.workspace_id, folders, folderBuckets.uncategorized, sharedDeskPositions]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!((_a = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _a === void 0 ? void 0 : _a.workspace_id) || !sharedSceneReady || typeof window === "undefined")
            return;
        window.localStorage.setItem(getDeskStorageKey(workspace.workspace.workspace_id), JSON.stringify(deskPositions));
    }, [deskPositions, sharedSceneReady, (_s = workspace === null || workspace === void 0 ? void 0 : workspace.workspace) === null || _s === void 0 ? void 0 : _s.workspace_id]);
    function getNextFolderSpawnPosition(folderId) {
        var guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
        var template = deskPositions[globalDeskTemplate_1.FOLDER_TEMPLATE_ID] || {};
        var folderCountInTray = folders.filter(function (folder) {
            var position = deskPositions["folder:".concat(folder.id)];
            if (!position)
                return true;
            var centerX = (position.x || 0) + ((position.width || DESK_FOLDER_WIDTH) / 2);
            var centerY = (position.y || 0) + ((position.height || DESK_FOLDER_HEIGHT) / 2);
            return centerX >= guideRect.x && centerX <= guideRect.x + guideRect.width && centerY >= guideRect.y && centerY <= guideRect.y + guideRect.height;
        }).length;
        return {
            x: guideRect.x + 8 + folderCountInTray * 12,
            y: guideRect.y + 6 + folderCountInTray * 7,
            z: deskLayer + folderCountInTray + 1,
            width: template.width,
            height: template.height,
            rotation: template.rotation,
            tiltX: template.tiltX,
            tiltY: template.tiltY,
            clipTlx: template.clipTlx,
            clipTly: template.clipTly,
            clipTrx: template.clipTrx,
            clipTry: template.clipTry,
            clipBrx: template.clipBrx,
            clipBry: template.clipBry,
            clipBlx: template.clipBlx,
            clipBly: template.clipBly,
        };
    }
    (0, react_1.useEffect)(function () {
        var pending = pendingCreatedFolderRef.current;
        if (!pending)
            return;
        var folderExists = folders.some(function (item) { return item.id === pending.id; });
        if (!folderExists)
            return;
        var nextPosition = getNextFolderSpawnPosition(pending.id);
        setDeskPositions(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a["folder:".concat(pending.id)] = __assign(__assign({}, (prev["folder:".concat(pending.id)] || {})), nextPosition), _a)));
        });
        pendingCreatedFolderRef.current = null;
    }, [deskLayer, deskPositions, folders]);
    var bringDeskItemToFront = (0, react_1.useCallback)(function (itemId) {
        setDeskLayer(function (current) {
            var next = current + 1;
            setDeskPositions(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[itemId] = __assign(__assign({}, (prev[itemId] || { x: 48, y: 48, z: next })), { z: next }), _a)));
            });
            return next;
        });
    }, []);
    var isInsideGuideRect = (0, react_1.useCallback)(function (x, y) {
        var rect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
        var centerX = x + 48;
        var centerY = y + 48;
        return centerX >= rect.x && centerX <= rect.x + rect.width && centerY >= rect.y && centerY <= rect.y + rect.height;
    }, [deskPositions]);
    var trashGuideRect = (0, react_1.useMemo)(function () { return getGuideClipRect(deskPositions[TRASH_GUIDE_ID]); }, [deskPositions]);
    var placeDeskItem = (0, react_1.useCallback)(function (itemId, kind, x, y) {
        var current = deskPositions[itemId] || {};
        var itemWidth = current.width || (kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH);
        var itemHeight = current.height || (kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT);
        var minX = kind === "project" ? -itemWidth * 0.5 : 24;
        var minY = kind === "project" ? -itemHeight * 0.5 : 24;
        var maxX = kind === "project" ? DESK_WIDTH - itemWidth * 0.5 : DESK_WIDTH - itemWidth - 24;
        var maxY = kind === "project" ? DESK_HEIGHT - itemHeight * 0.5 : DESK_HEIGHT - itemHeight - 24;
        var nextX = clampDesk(x, minX, maxX);
        var nextY = clampDesk(y, minY, maxY);
        if (kind === "folder") {
            var folderId_1 = itemId.replace("folder:", "");
            var folderIndex = Math.max(0, folders.findIndex(function (item) { return item.id === folderId_1; }));
            var guideRect = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
            var snapped_1 = isInsideGuideRect(nextX, nextY)
                ? { x: guideRect.x + 8 + folderIndex * 12, y: guideRect.y + 6 + folderIndex * 7, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY }
                : { x: nextX, y: nextY, z: 20 + folderIndex, width: current.width, height: current.height, rotation: current.rotation, tiltX: current.tiltX, tiltY: current.tiltY };
            setDeskPositions(function (prev) {
                var _a;
                var _b;
                return (__assign(__assign({}, prev), (_a = {}, _a[itemId] = __assign(__assign({}, (prev[itemId] || { z: deskLayer + 1 })), { x: snapped_1.x, y: snapped_1.y, z: ((_b = prev[itemId]) === null || _b === void 0 ? void 0 : _b.z) || deskLayer + 1, width: snapped_1.width, height: snapped_1.height, rotation: snapped_1.rotation }), _a)));
            });
            return;
        }
        setDeskPositions(function (prev) {
            var _a;
            var _b;
            return (__assign(__assign({}, prev), (_a = {}, _a[itemId] = __assign(__assign({}, (prev[itemId] || { z: deskLayer + 1 })), { x: nextX, y: nextY, z: ((_b = prev[itemId]) === null || _b === void 0 ? void 0 : _b.z) || deskLayer + 1, width: current.width, height: current.height, rotation: current.rotation }), _a)));
        });
    }, [deskLayer, deskPositions, folders, isInsideGuideRect]);
    var handleDeskDrop = (0, react_1.useCallback)(function (e) {
        e.preventDefault();
        var rect = e.currentTarget.getBoundingClientRect();
        var draggedProjectId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
        var draggedFolderId = e.dataTransfer.getData("text/folder-id") || "";
        if (draggedProjectId) {
            var wasInFolder = !folderBuckets.uncategorized.some(function (project) { return project.id === draggedProjectId; });
            var itemId = "project:".concat(draggedProjectId);
            bringDeskItemToFront(itemId);
            placeDeskItem(itemId, "project", e.clientX - rect.left - DESK_SHEET_WIDTH / 2, e.clientY - rect.top - DESK_SHEET_HEIGHT / 2);
            if (wasInFolder) {
                moveProject(draggedProjectId, null);
            }
            setDraggingProjectId(null);
            clearTrashHover();
            return;
        }
        if (draggedFolderId) {
            var itemId = "folder:".concat(draggedFolderId);
            bringDeskItemToFront(itemId);
            placeDeskItem(itemId, "folder", e.clientX - rect.left - DESK_FOLDER_WIDTH / 2, e.clientY - rect.top - DESK_FOLDER_HEIGHT / 2);
            setDraggingFolderId(null);
            clearTrashHover();
        }
    }, [bringDeskItemToFront, clearTrashHover, draggingProjectId, folderBuckets.uncategorized, moveProject, placeDeskItem]);
    function createFolderNamed(nameValue_1) {
        return __awaiter(this, arguments, void 0, function (nameValue, iconKey) {
            var name, resp, json, newFolderId_1, nextPosition_1, e_3;
            var _a;
            if (iconKey === void 0) { iconKey = newFolderIcon; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        name = nameValue.trim();
                        if (!name || !session)
                            return [2 /*return*/];
                        setBusyFolderId("new");
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/create", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ name: name, icon_key: iconKey }),
                            })];
                    case 2:
                        resp = _b.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _b.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось создать папку");
                        newFolderId_1 = String(((_a = json === null || json === void 0 ? void 0 : json.folder) === null || _a === void 0 ? void 0 : _a.id) || "");
                        if (newFolderId_1) {
                            pendingCreatedFolderRef.current = { id: newFolderId_1 };
                            nextPosition_1 = getNextFolderSpawnPosition(newFolderId_1);
                            setDeskPositions(function (prev) {
                                var _a;
                                return (__assign(__assign({}, prev), (_a = {}, _a["folder:".concat(newFolderId_1)] = nextPosition_1, _a)));
                            });
                        }
                        setNewFolderName("");
                        setNewFolderIcon("folder");
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_3 = _b.sent();
                        setError((e_3 === null || e_3 === void 0 ? void 0 : e_3.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function promptAndCreateFolder() {
        var name = typeof window !== 'undefined' ? window.prompt('Название новой папки', 'Новая папка') : null;
        if (name && name.trim())
            void createFolderNamed(name.trim(), 'folder');
    }
    function createFolder() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, createFolderNamed(newFolderName, newFolderIcon)];
            });
        });
    }
    function openRenameFolder(folder) {
        setFolderActionTarget(null);
        setFolderRenameTarget(folder);
        setFolderRenameValue(folder.name);
    }
    function saveRenameFolder() {
        return __awaiter(this, void 0, void 0, function () {
            var name, resp, json, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session || !folderRenameTarget)
                            return [2 /*return*/];
                        name = folderRenameValue.trim();
                        if (!name || name === folderRenameTarget.name) {
                            setFolderRenameTarget(null);
                            return [2 /*return*/];
                        }
                        setBusyFolderId(folderRenameTarget.id);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/update", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ id: folderRenameTarget.id, name: name }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось переименовать папку");
                        setFolderRenameTarget(null);
                        setFolderRenameValue("");
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_4 = _a.sent();
                        setError((e_4 === null || e_4 === void 0 ? void 0 : e_4.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function updateFolderIcon(folder, iconKey) {
        return __awaiter(this, void 0, void 0, function () {
            var resp, json, e_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session)
                            return [2 /*return*/];
                        setBusyFolderId(folder.id);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/update", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ id: folder.id, icon_key: iconKey }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось обновить иконку");
                        setIconPickerFolder(null);
                        setFolderActionTarget(null);
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_5 = _a.sent();
                        setError((e_5 === null || e_5 === void 0 ? void 0 : e_5.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function openDeleteFolder(folder) {
        setFolderActionTarget(null);
        setFolderDeleteTarget(folder);
    }
    function confirmDeleteFolder() {
        return __awaiter(this, void 0, void 0, function () {
            var folder, resp, json, e_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session || !folderDeleteTarget)
                            return [2 /*return*/];
                        folder = folderDeleteTarget;
                        setBusyFolderId(folder.id);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/delete", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ id: folder.id }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось удалить папку");
                        setFolderDeleteTarget(null);
                        setActiveFolderId(function (current) { return (current === folder.id ? null : current); });
                        setIconPickerFolder(function (current) { return ((current === null || current === void 0 ? void 0 : current.id) === folder.id ? null : current); });
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_6 = _a.sent();
                        setError((e_6 === null || e_6 === void 0 ? void 0 : e_6.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function deleteFolderDirect(folderId) {
        return __awaiter(this, void 0, void 0, function () {
            var resp, json, e_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session)
                            return [2 /*return*/];
                        setBusyFolderId(folderId);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/delete", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ id: folderId }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось удалить папку");
                        setFolderDeleteTarget(null);
                        setActiveFolderId(function (current) { return (current === folderId ? null : current); });
                        setIconPickerFolder(function (current) { return ((current === null || current === void 0 ? void 0 : current.id) === folderId ? null : current); });
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_7 = _a.sent();
                        setError((e_7 === null || e_7 === void 0 ? void 0 : e_7.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function moveProject(projectId, folderId) {
        return __awaiter(this, void 0, void 0, function () {
            var resp, json, e_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session)
                            return [2 /*return*/];
                        setBusyFolderId(folderId || "desktop");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/folders/move-project", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ project_id: projectId, folder_id: folderId }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось переместить проект");
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_8 = _a.sent();
                        setError((e_8 === null || e_8 === void 0 ? void 0 : e_8.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setDraggingProjectId(null);
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function deleteProject(projectId_1) {
        return __awaiter(this, arguments, void 0, function (projectId, skipConfirm) {
            var resp, json, e_9;
            if (skipConfirm === void 0) { skipConfirm = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!session)
                            return [2 /*return*/];
                        if (!skipConfirm && !window.confirm("Удалить проект? Это действие уберёт проект, приглашение и результаты по нему."))
                            return [2 /*return*/];
                        setBusyFolderId("delete:".concat(projectId));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, 6, 7]);
                        return [4 /*yield*/, fetch("/api/commercial/projects/delete", {
                                method: "POST",
                                headers: {
                                    "content-type": "application/json",
                                    authorization: "Bearer ".concat(session.access_token),
                                },
                                body: JSON.stringify({ project_id: projectId }),
                            })];
                    case 2:
                        resp = _a.sent();
                        return [4 /*yield*/, resp.json().catch(function () { return ({}); })];
                    case 3:
                        json = _a.sent();
                        if (!resp.ok || !(json === null || json === void 0 ? void 0 : json.ok))
                            throw new Error((json === null || json === void 0 ? void 0 : json.error) || "Не удалось удалить проект");
                        return [4 /*yield*/, loadDashboard()];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        e_9 = _a.sent();
                        setError((e_9 === null || e_9 === void 0 ? void 0 : e_9.message) || "Ошибка");
                        return [3 /*break*/, 7];
                    case 6:
                        setBusyFolderId(null);
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        });
    }
    function clearTrashHover() {
        if (trashHoverTimer.current) {
            window.clearTimeout(trashHoverTimer.current);
            trashHoverTimer.current = null;
        }
        setTrashHover(null);
    }
    var beginTrashHover = (0, react_1.useCallback)(function (kind, id) {
        setTrashHover(function (current) {
            if ((current === null || current === void 0 ? void 0 : current.kind) === kind && (current === null || current === void 0 ? void 0 : current.id) === id)
                return current;
            return { kind: kind, id: id };
        });
        if (trashHoverTimer.current)
            window.clearTimeout(trashHoverTimer.current);
        trashHoverTimer.current = window.setTimeout(function () {
            var _a;
            if (kind === "project") {
                var project = ((workspace === null || workspace === void 0 ? void 0 : workspace.projects) || []).find(function (item) { return item.id === id; });
                moveToTrash("project", id, (project === null || project === void 0 ? void 0 : project.title) || ((_a = project === null || project === void 0 ? void 0 : project.person) === null || _a === void 0 ? void 0 : _a.full_name) || "Проект");
            }
            else {
                var folder = ((workspace === null || workspace === void 0 ? void 0 : workspace.folders) || []).find(function (item) { return item.id === id; });
                moveToTrash("folder", id, (folder === null || folder === void 0 ? void 0 : folder.name) || "Папка");
            }
            setDraggingProjectId(null);
            setDraggingFolderId(null);
            setTrashHover(null);
            trashHoverTimer.current = null;
        }, 650);
    }, [moveToTrash, workspace === null || workspace === void 0 ? void 0 : workspace.folders, workspace === null || workspace === void 0 ? void 0 : workspace.projects]);
    (0, react_1.useEffect)(function () { return function () {
        if (trashHoverTimer.current)
            window.clearTimeout(trashHoverTimer.current);
    }; }, []);
    (0, react_1.useEffect)(function () {
        var now = Date.now();
        var expired = trashEntries.filter(function (item) { return item.expiresAt <= now; });
        if (!expired.length)
            return;
        setTrashEntries(function (prev) { return prev.filter(function (item) { return item.expiresAt > now; }); });
        expired.forEach(function (entry) {
            if (entry.kind === "project")
                void deleteProject(entry.id, true);
            else
                void deleteFolderDirect(entry.id);
        });
    }, [trashEntries]);
    if (!session || !user) {
        return (<Layout_1.Layout title="Кабинет">
        <div className="card text-sm text-slate-700">Переадресация на вход…</div>
      </Layout_1.Layout>);
    }
    var trayFolders = folderBuckets.byFolder.filter(function (_a, index) {
        var folder = _a.folder;
        var pos = deskPositions["folder:".concat(folder.id)] || getDefaultFolderPosition(index);
        return isInsideGuideRect(pos.x, pos.y);
    });
    var looseFolders = folderBuckets.byFolder.filter(function (_a, index) {
        var folder = _a.folder;
        var pos = deskPositions["folder:".concat(folder.id)] || getDefaultFolderPosition(index);
        return !isInsideGuideRect(pos.x, pos.y);
    });
    if (desktopVariant === "classic") {
        return (<Layout_1.Layout title="Кабинет специалиста">
        <div className="dashboard-experience dashboard-experience-classic relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4">
          {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a5b37]">Кабинет специалиста</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xl font-semibold text-[#2c1b10]">{displayName}</span>
                <span className="text-sm text-[#6a4b31]">{workspaceName}</span>
                <span className="text-sm text-[#8b6a48]">{((_t = data === null || data === void 0 ? void 0 : data.profile) === null || _t === void 0 ? void 0 : _t.email) || user.email || "email не указан"}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="dashboard-desk-meta-pill">Баланс: {balanceText}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={function () { return setDesktopVariant("scheme"); }}>Схема на доске</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={function () { return router.push('/assessments'); }}>Каталог тестов</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={promptAndCreateFolder}>Новая папка</button>
              {canEditScene ? (<>
                  <button type="button" className={"btn btn-sm ".concat(sceneEditMode ? "btn-primary" : "btn-secondary")} onClick={function () { return setSceneEditMode(function (prev) { return !prev; }); }}>
                    {sceneEditMode ? "Выйти из конструктора" : "Режим конструктора"}
                  </button>
                  {sceneEditMode ? (<button type="button" className="btn btn-secondary btn-sm" onClick={resetSceneWidgets}>Сбросить сцену</button>) : null}
                </>) : null}
            </div>
          </div>

          {canEditScene && sceneEditMode && selectedDeskItem ? (<div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
              <div className="mb-3 text-sm font-semibold text-[#55361f]">Объект · {selectedDeskItem.title}</div>
              <div className="grid gap-3 md:grid-cols-7">
                <label className="text-xs text-[#7b5b3b]">X
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.x || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Y
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.y || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Ширина
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "folder" ? 96 : 92))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Высота
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "folder" ? 96 : 104))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот Z
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.rotation || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот X
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltX || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) }); }}/>
                </label>
                <label className="text-xs text-[#7b5b3b]">Поворот Y
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltY || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) }); }}/>
                </label>
              </div>
            </div>) : null}

          <div className="dashboard-classic-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#d4d9e4] bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.14)]" onClick={function () { setSelectedWidgetId(null); setSelectedDeskItemId(null); }} onDragOver={function (e) { return e.preventDefault(); }} onDrop={handleDeskDrop}>
            <div className="dashboard-classic-surface absolute inset-0"/>
            {folderBuckets.byFolder.map(function (_a, folderIndex) {
                var folder = _a.folder, folderProjects = _a.projects;
                var itemId = "folder:".concat(folder.id);
                var position = deskPositions[itemId] || getClassicFolderPosition(folderIndex);
                var width = position.width || 104;
                var height = position.height || 108;
                var isSelected = selectedDeskItemId === itemId;
                return (<div key={folder.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: "".concat(width, "px"), height: "".concat(height, "px") }}>
                  <FolderDesktopIcon variant="classic" folder={folder} projects={folderProjects} busy={busyFolderId === folder.id} onOpen={function () { return setActiveFolderId(folder.id); }} onManage={function () { return setFolderActionTarget(folder); }} onDropProject={function (projectId) { return moveProject(projectId, folder.id); }} draggingProjectId={draggingProjectId} sceneEditMode={sceneEditMode} selected={isSelected} onSelect={function () { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }} onResizeHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "resize", position); }} onRotateHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "rotate", position); }} onDragMoveStart={function (e) { return startDeskItemInteraction(e, itemId, "folder", "drag", position); }} onDragStart={function () { setDraggingFolderId(folder.id); bringDeskItemToFront(itemId); }} onDragEnd={function () { return setDraggingFolderId(null); }}/>
                </div>);
            })}

            {folderBuckets.uncategorized.map(function (project, projectIndex) {
                var itemId = "project:".concat(project.id);
                var position = deskPositions[itemId] || getClassicProjectPosition(projectIndex);
                var width = position.width || 96;
                var height = position.height || 112;
                var isSelected = selectedDeskItemId === itemId;
                return (<div key={project.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: "".concat(width, "px"), height: "".concat(height, "px") }}>
                  <ProjectDesktopIcon variant="classic" project={project} busy={busyFolderId === "delete:".concat(project.id)} sceneEditMode={sceneEditMode} selected={isSelected} onSelect={function () { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }} onResizeHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "project", "resize", position); }} onRotateHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "project", "rotate", position); }} onDragMoveStart={function (e) { return startDeskItemInteraction(e, itemId, "project", "drag", position); }} onOpen={function () { return setPreviewProject(project); }} onDragStart={function () { setDraggingProjectId(project.id); bringDeskItemToFront(itemId); }} onDragEnd={function () { setDraggingProjectId(null); clearTrashHover(); }} onDelete={function () { return deleteProject(project.id); }}/>
                </div>);
            })}
          </div>

          {activeFolder ? (<FolderModal folder={activeFolder.folder} projects={activeFolder.projects} busy={busyFolderId === activeFolder.folder.id} onClose={function () { return setActiveFolderId(null); }} onManage={function () { return setFolderActionTarget(activeFolder.folder); }} onOpenProject={function (projectId) {
                    var project = activeFolder.projects.find(function (item) { return item.id === projectId; });
                    if (project)
                        setPreviewProject(project);
                }} onMoveToDesktop={function (projectId) { return moveProject(projectId, null); }} onDeleteProject={deleteProject}/>) : null}

          {previewProject ? (<ProjectSheetPreviewModal project={previewProject} onClose={function () { return setPreviewProject(null); }} onOpenFull={function () { return router.push("/projects/".concat(previewProject.id)); }}/>) : null}
        </div>
      </Layout_1.Layout>);
    }
    return (<Layout_1.Layout title="Кабинет специалиста">
      <div className="dashboard-experience relative isolate -mx-3 overflow-hidden rounded-[36px] px-3 py-3 sm:-mx-4 sm:px-4 sm:py-4">
        {error ? <div className="mb-4 card dashboard-panel text-sm text-red-600">{error}</div> : null}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_16px_30px_-26px_rgba(54,35,19,0.18)] backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7a5b37]">Кабинет специалиста</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xl font-semibold text-[#2c1b10]">{displayName}</span>
              <span className="text-sm text-[#6a4b31]">{workspaceName}</span>
              <span className="text-sm text-[#8b6a48]">{((_u = data === null || data === void 0 ? void 0 : data.profile) === null || _u === void 0 ? void 0 : _u.email) || user.email || "email не указан"}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="dashboard-desk-meta-pill">Баланс: {balanceText}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={function () { return setDesktopVariant(function (prev) { return (prev === "scheme" ? "classic" : "scheme"); }); }}>
              {desktopVariant === "scheme" ? "Рабочий стол" : "Схема на доске"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={function () { return router.push('/assessments'); }}>Каталог тестов</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={promptAndCreateFolder}>Новая папка</button>
            {canEditScene ? (<>
                <button type="button" className={"btn btn-sm ".concat(sceneEditMode ? "btn-primary" : "btn-secondary")} onClick={function () { return setSceneEditMode(function (prev) { return !prev; }); }}>
                  {sceneEditMode ? "Выйти из конструктора" : "Режим конструктора"}
                </button>
                {sceneEditMode ? (<button type="button" className="btn btn-secondary btn-sm" onClick={resetSceneWidgets}>Сбросить сцену</button>) : null}
              </>) : null}
          </div>
        </div>

        {canEditScene && sceneEditMode && selectedWidget ? (<div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
            <div className="mb-3 text-sm font-semibold text-[#55361f]">Конструктор сцены · {selectedWidget.id}</div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs text-[#7b5b3b]">X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.x)} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { x: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.y)} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { y: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Ширина
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.width)} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { width: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Высота
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedWidget.height)} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { height: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b] md:col-span-1">Поворот
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={selectedWidget.rotation} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { rotation: Number(e.target.value || 0) }); }}/>
              </label>
              {selectedWidget.kind !== "image" ? (<>
                  <label className="text-xs text-[#7b5b3b] md:col-span-1">Шрифт
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={selectedWidget.fontSize} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { fontSize: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b] md:col-span-2">Текст
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="text" value={selectedWidget.text} onChange={function (e) { return updateSceneWidget(selectedWidget.id, { text: e.target.value }); }}/>
                  </label>
                </>) : (<label className="text-xs text-[#7b5b3b] md:col-span-3">Изображение
                  <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] bg-[#f8f3ea] px-3 py-2 text-sm text-[#7b5b3b]" type="text" value={selectedWidget.src || ""} readOnly/>
                </label>)}
            </div>
          </div>) : null}

        {canEditScene && sceneEditMode && selectedDeskItem ? (<div className="mb-3 rounded-[22px] border border-[#cdb799] bg-white/92 p-4 shadow-[0_18px_34px_-26px_rgba(54,35,19,0.2)]">
            <div className="mb-3 text-sm font-semibold text-[#55361f]">Объект на столе · {selectedDeskItem.title}</div>
            <div className="grid gap-3 md:grid-cols-7">
              <label className="text-xs text-[#7b5b3b]">X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.x || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { x: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.y || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { y: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Ширина
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.width || (selectedDeskItem.kind === "guide" ? 228 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_WIDTH : DESK_SHEET_WIDTH))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { width: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Высота
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.height || (selectedDeskItem.kind === "guide" ? 104 : selectedDeskItem.kind === "folder" ? DESK_FOLDER_HEIGHT : DESK_SHEET_HEIGHT))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { height: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот Z
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.rotation || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { rotation: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот X
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltX || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { tiltX: Number(e.target.value || 0) }); }}/>
              </label>
              <label className="text-xs text-[#7b5b3b]">Поворот Y
                <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" step="0.1" value={Number((selectedDeskItem.position.tiltY || 0).toFixed(1))} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { tiltY: Number(e.target.value || 0) }); }}/>
              </label>
              {selectedDeskItem.kind === "guide" ? (<>
                  {selectedDeskItem.id === TRAY_GUIDE_ID ? (<label className="text-xs text-[#7b5b3b] md:col-span-7">Текст на стойке
                      <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="text" value={trayGuideText} onChange={function (e) { return setTrayGuideText(e.target.value); }}/>
                    </label>) : null}
                  <label className="text-xs text-[#7b5b3b]">TL X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTlx || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipTlx: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TL Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTly || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipTly: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TR X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTrx || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipTrx: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">TR Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipTry || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipTry: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BR X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBrx || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipBrx: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BR Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBry || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipBry: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BL X
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBlx || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipBlx: Number(e.target.value || 0) }); }}/>
                  </label>
                  <label className="text-xs text-[#7b5b3b]">BL Y
                    <input className="mt-1 w-full rounded-lg border border-[#d9c6ab] px-3 py-2 text-sm" type="number" value={Math.round(selectedDeskItem.position.clipBly || 0)} onChange={function (e) { return updateDeskItem(selectedDeskItem.id, { clipBly: Number(e.target.value || 0) }); }}/>
                  </label>
                </>) : null}
            </div>
            {selectedDeskItem.kind !== "guide" ? (<div className="mt-3 border-t border-[#ead9c2] pt-3">
                {templateFeedback ? (<div aria-live="polite" className={"mb-3 rounded-2xl border px-3 py-2 text-sm font-medium ".concat(templateFeedback.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
                    {templateFeedback.kind === "success" ? "✓ " : "⚠ "}{templateFeedback.text}
                  </div>) : null}
                <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={function () { return saveDeskItemAsTemplate(selectedDeskItem.id, selectedDeskItem.kind); }}>
                  {isAdmin ? "Сохранить стандарт для всех " : "Сохранить шаблон для всех "}{selectedDeskItem.kind === "folder" ? "папок" : "листов"}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={function () { return applyDeskTemplateToExistingItems(selectedDeskItem.kind); }}>
                  Применить стандарт ко всем {selectedDeskItem.kind === "folder" ? "папкам" : "листам"}
                </button>
                </div>
                <div className="mt-2 text-xs text-[#8a6a47]">Стандарт хранится на сервере и подхватывается у новых пользователей и на других устройствах.</div>
              </div>) : null}
          </div>) : null}

        <div className="dashboard-office-scene relative min-h-[920px] overflow-hidden rounded-[34px] border border-[#4f3420]/10 bg-white shadow-[0_30px_70px_-44px_rgba(53,34,17,0.28)]">
          <div className="dashboard-office-scene-backdrop absolute inset-0"/>
          <div className="dashboard-office-scene-vignette absolute inset-0"/>

          <div className="dashboard-office-workzone absolute inset-0 overflow-hidden" onClick={function () { setSelectedWidgetId(null); setSelectedDeskItemId(null); }} onDragOver={function (e) { return e.preventDefault(); }} onDrop={handleDeskDrop}>
            <div className="absolute inset-0 z-[8]">
              {sceneWidgets.map(function (widget) {
            var isSelected = widget.id === selectedWidgetId;
            return (<div key={widget.id} className={"dashboard-scene-widget dashboard-scene-widget-".concat(widget.kind, " dashboard-scene-widget-").concat(widget.tone || "note", " ").concat(sceneEditMode ? "dashboard-scene-widget-editing" : "", " ").concat(isSelected ? "dashboard-scene-widget-selected" : "")} style={{
                    left: "".concat(widget.x, "px"),
                    top: "".concat(widget.y, "px"),
                    width: "".concat(widget.width, "px"),
                    height: "".concat(widget.height, "px"),
                    transform: "rotate(".concat(widget.rotation, "deg)"),
                    zIndex: widget.z,
                    fontSize: "".concat(widget.fontSize, "px"),
                    pointerEvents: widget.kind === "image" && !sceneEditMode ? "none" : "auto",
                }} onMouseDown={function (e) { return startWidgetInteraction(e, widget, "drag"); }} onClick={function (e) {
                    e.stopPropagation();
                    if (widget.kind === "image" && !sceneEditMode)
                        return;
                    setSelectedWidgetId(widget.id);
                    setSelectedDeskItemId(null);
                    if (!sceneEditMode && widget.kind === "button")
                        handleSceneWidgetAction(widget.action);
                }} onDoubleClick={function (e) {
                    e.stopPropagation();
                    if (widget.kind === "button")
                        handleSceneWidgetAction(widget.action);
                }}>
                    {widget.kind === "image" ? (<img className="dashboard-scene-widget-image-el" src={widget.src} alt="Схема на доске" draggable={false}/>) : (<span className="dashboard-scene-widget-label">{widget.text}</span>)}
                    {sceneEditMode && isSelected ? (<>
                        <button type="button" className="dashboard-scene-widget-rotate" onMouseDown={function (e) { return startWidgetInteraction(e, widget, "rotate"); }} aria-label="Повернуть элемент">↻</button>
                        <button type="button" className="dashboard-scene-widget-resize" onMouseDown={function (e) { return startWidgetInteraction(e, widget, "resize"); }} aria-label="Изменить размер элемента">↘</button>
                      </>) : null}
                  </div>);
        })}
            </div>
            {(function () {
            var trashPosition = deskPositions[TRASH_GUIDE_ID] || getDefaultTrashGuidePosition();
            var width = trashPosition.width || TRASH_ZONE.width;
            var height = trashPosition.height || TRASH_ZONE.height;
            var isSelected = selectedDeskItemId === TRASH_GUIDE_ID;
            return (<div className={"dashboard-trash-zone absolute z-[14] ".concat(trashHover ? 'dashboard-trash-zone-active' : '', " ").concat(sceneEditMode ? 'dashboard-trash-zone-editing' : '', " ").concat(isSelected ? 'dashboard-desk-entity-selected' : '')} style={{ left: "".concat(trashPosition.x, "px"), top: "".concat(trashPosition.y, "px"), width: "".concat(width, "px"), height: "".concat(height, "px"), transform: getGuideTransform(trashPosition), transformOrigin: 'top left' }} onClick={function (e) {
                    e.stopPropagation();
                    if (sceneEditMode) {
                        setSelectedDeskItemId(TRASH_GUIDE_ID);
                        setSelectedWidgetId(null);
                    }
                    else {
                        setTrashOpen(true);
                    }
                }} onMouseDown={function (e) {
                    if (!sceneEditMode)
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDeskItemId(TRASH_GUIDE_ID);
                    setSelectedWidgetId(null);
                    startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'drag', trashPosition);
                }} onDragEnter={function (e) {
                    e.preventDefault();
                    var draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    var draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId)
                        beginTrashHover('project', draggedProjectId);
                    else if (draggedFolderId)
                        beginTrashHover('folder', draggedFolderId);
                }} onDragOver={function (e) {
                    e.preventDefault();
                    var draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    var draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId)
                        beginTrashHover('project', draggedProjectId);
                    else if (draggedFolderId)
                        beginTrashHover('folder', draggedFolderId);
                }} onDragLeave={function () { return clearTrashHover(); }} onDrop={function (e) {
                    var _a;
                    e.preventDefault();
                    var draggedProjectId = e.dataTransfer.getData('text/project-id') || draggingProjectId;
                    var draggedFolderId = e.dataTransfer.getData('text/folder-id') || draggingFolderId;
                    if (draggedProjectId) {
                        var project = ((workspace === null || workspace === void 0 ? void 0 : workspace.projects) || []).find(function (item) { return item.id === draggedProjectId; });
                        moveToTrash('project', draggedProjectId, (project === null || project === void 0 ? void 0 : project.title) || ((_a = project === null || project === void 0 ? void 0 : project.person) === null || _a === void 0 ? void 0 : _a.full_name) || 'Проект');
                        setDraggingProjectId(null);
                    }
                    else if (draggedFolderId) {
                        var folder = ((workspace === null || workspace === void 0 ? void 0 : workspace.folders) || []).find(function (item) { return item.id === draggedFolderId; });
                        moveToTrash('folder', draggedFolderId, (folder === null || folder === void 0 ? void 0 : folder.name) || 'Папка');
                        setDraggingFolderId(null);
                    }
                    clearTrashHover();
                }} aria-label="Корзина" title="Корзина">
                  {sceneEditMode ? <span className="dashboard-trash-zone-label">Корзина</span> : null}
                  {sceneEditMode && isSelected ? (<>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={function (e) { return startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'rotate', trashPosition); }} aria-label="Повернуть зону корзины">↻</button>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={function (e) { return startDeskItemInteraction(e, TRASH_GUIDE_ID, 'guide', 'resize', trashPosition); }} aria-label="Изменить размер зоны корзины">↘</button>
                    </>) : null}
                </div>);
        })()}
            {(function () {
            var guidePosition = deskPositions[TRAY_GUIDE_ID] || getDefaultTrayGuidePosition();
            var guideWidth = guidePosition.width || 228;
            var guideHeight = guidePosition.height || 104;
            var guideRotation = guidePosition.rotation || 0;
            var guideTiltX = guidePosition.tiltX || 0;
            var guideTiltY = guidePosition.tiltY || 0;
            var isSelected = selectedDeskItemId === TRAY_GUIDE_ID;
            return (<div className={"absolute ".concat(isSelected ? "dashboard-desk-entity-selected" : "")} style={{
                    left: guidePosition.x,
                    top: guidePosition.y,
                    zIndex: isSelected ? 19 : 11,
                    width: "".concat(guideWidth, "px"),
                    height: "".concat(guideHeight, "px"),
                    transform: "perspective(1400px) rotateX(".concat(guideTiltX, "deg) rotateY(").concat(guideTiltY, "deg) rotate(").concat(guideRotation, "deg)"),
                    transformOrigin: 'top left',
                    transformStyle: 'preserve-3d',
                    pointerEvents: sceneEditMode ? 'auto' : 'none'
                }}>
                  <div className={"dashboard-tray-guide-box ".concat(sceneEditMode ? "dashboard-tray-guide-box-editing" : "")}>
                    <button type="button" className="dashboard-tray-guide-inner" style={{ clipPath: getGuideClipPath(guidePosition), pointerEvents: 'auto', cursor: sceneEditMode ? 'grab' : 'pointer' }} onMouseDown={function (e) {
                    if (!sceneEditMode)
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDeskItemId(TRAY_GUIDE_ID);
                    setSelectedWidgetId(null);
                    startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                }} onClick={function (e) {
                    e.stopPropagation();
                    if (!sceneEditMode) {
                        promptAndCreateFolder();
                    }
                }}>
                      <div className="dashboard-tray-guide-label">{trayGuideText}</div>
                    </button>
                  </div>
                  {sceneEditMode ? (<button type="button" className="dashboard-tray-guide-selector" style={{ pointerEvents: 'auto' }} onMouseDown={function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                        startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "drag", guidePosition);
                    }} onClick={function (e) {
                        e.stopPropagation();
                        setSelectedDeskItemId(TRAY_GUIDE_ID);
                        setSelectedWidgetId(null);
                    }} aria-label="Выбрать виртуальную стойку" title="Выбрать виртуальную стойку">
                      ⤢
                    </button>) : null}
                  {sceneEditMode && isSelected ? (<>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={function (e) { return startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "rotate", guidePosition); }} aria-label="Повернуть зону стойки">↻</button>
                      <button type="button" style={{ pointerEvents: 'auto' }} className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={function (e) { return startDeskItemInteraction(e, TRAY_GUIDE_ID, "guide", "resize", guidePosition); }} aria-label="Изменить размер зоны стойки">↘</button>
                    </>) : null}
                </div>);
        })()}

            {(function () {
            var guideClip = getGuideClipRect(deskPositions[TRAY_GUIDE_ID]);
            return (<div className="absolute z-[12] overflow-hidden" style={{ left: "".concat(guideClip.x, "px"), top: "".concat(guideClip.y, "px"), width: "".concat(guideClip.width, "px"), height: "".concat(guideClip.height, "px"), transform: getGuideTransform(deskPositions[TRAY_GUIDE_ID]), transformOrigin: 'top left', clipPath: getGuideClipPath(deskPositions[TRAY_GUIDE_ID]), pointerEvents: 'none' }}>
              {trayFolders.map(function (_a, folderIndex) {
                    var folder = _a.folder, folderProjects = _a.projects;
                    var itemId = "folder:".concat(folder.id);
                    var position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
                    var width = position.width || DESK_FOLDER_WIDTH;
                    var height = position.height || DESK_FOLDER_HEIGHT;
                    var rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
                    var isSelected = selectedDeskItemId === itemId;
                    return (<div key={folder.id} className="absolute" style={{ left: position.x - guideClip.x, top: position.y - guideClip.y, zIndex: position.z, width: "".concat(width, "px"), height: "".concat(height, "px"), transform: "perspective(1400px) rotateX(".concat(position.tiltX || 0, "deg) rotateY(").concat(position.tiltY || 0, "deg) rotate(").concat(rotation, "deg)"), transformStyle: 'preserve-3d', pointerEvents: 'auto' }}>
                    <FolderDesktopIcon folder={folder} projects={folderProjects} busy={busyFolderId === folder.id} onOpen={function () { return setActiveFolderId(folder.id); }} onManage={function () { return setFolderActionTarget(folder); }} onDropProject={function (projectId) { return moveProject(projectId, folder.id); }} draggingProjectId={draggingProjectId} sceneEditMode={sceneEditMode} selected={isSelected} onSelect={function () { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }} onResizeHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "resize", position); }} onRotateHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "rotate", position); }} onDragMoveStart={function (e) { return startDeskItemInteraction(e, itemId, "folder", "drag", position); }} onDragStart={function () {
                            setDraggingFolderId(folder.id);
                            bringDeskItemToFront(itemId);
                        }} onDragEnd={function () { return setDraggingFolderId(null); }}/>
                  </div>);
                })}
            </div>);
        })()}

            {looseFolders.map(function (_a, folderIndex) {
            var folder = _a.folder, folderProjects = _a.projects;
            var itemId = "folder:".concat(folder.id);
            var position = deskPositions[itemId] || getDefaultFolderPosition(folderIndex);
            var width = position.width || DESK_FOLDER_WIDTH;
            var height = position.height || DESK_FOLDER_HEIGHT;
            var rotation = (position.rotation || 0) + getEntityTilt(folder.id, 2) * 0.42;
            var isSelected = selectedDeskItemId === itemId;
            return (<div key={folder.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: "".concat(width, "px"), height: "".concat(height, "px"), transform: "perspective(1400px) rotateX(".concat(position.tiltX || 0, "deg) rotateY(").concat(position.tiltY || 0, "deg) rotate(").concat(rotation, "deg)"), transformStyle: 'preserve-3d' }}>
                  <FolderDesktopIcon folder={folder} projects={folderProjects} busy={busyFolderId === folder.id} onOpen={function () { return setActiveFolderId(folder.id); }} onManage={function () { return setFolderActionTarget(folder); }} onDropProject={function (projectId) { return moveProject(projectId, folder.id); }} draggingProjectId={draggingProjectId} sceneEditMode={sceneEditMode} selected={isSelected} onSelect={function () { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }} onResizeHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "resize", position); }} onRotateHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "folder", "rotate", position); }} onDragMoveStart={function (e) { return startDeskItemInteraction(e, itemId, "folder", "drag", position); }} onDragStart={function () {
                    setDraggingFolderId(folder.id);
                    bringDeskItemToFront(itemId);
                }} onDragEnd={function () { return setDraggingFolderId(null); }}/>
                </div>);
        })}

            {folderBuckets.uncategorized.map(function (project, projectIndex) {
            var itemId = "project:".concat(project.id);
            var position = deskPositions[itemId] || getDefaultProjectPosition(projectIndex);
            var width = position.width || DESK_SHEET_WIDTH;
            var height = position.height || DESK_SHEET_HEIGHT;
            var rotation = (position.rotation || 0) + getEntityTilt(project.id, 1) * 0.18;
            var isSelected = selectedDeskItemId === itemId;
            return (<div key={project.id} className="absolute" style={{ left: position.x, top: position.y, zIndex: position.z, width: "".concat(width, "px"), height: "".concat(height, "px"), transform: "perspective(1400px) rotateX(".concat(position.tiltX || 0, "deg) rotateY(").concat(position.tiltY || 0, "deg) rotate(").concat(rotation, "deg)"), transformStyle: 'preserve-3d' }}>
                  <ProjectDesktopIcon project={project} busy={busyFolderId === "delete:".concat(project.id)} sceneEditMode={sceneEditMode} selected={isSelected} onSelect={function () { setSelectedDeskItemId(itemId); setSelectedWidgetId(null); }} onResizeHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "project", "resize", position); }} onRotateHandleMouseDown={function (e) { return startDeskItemInteraction(e, itemId, "project", "rotate", position); }} onDragMoveStart={function (e) { return startDeskItemInteraction(e, itemId, "project", "drag", position); }} onOpen={function () { return setPreviewProject(project); }} onDragStart={function () {
                    setDraggingProjectId(project.id);
                    bringDeskItemToFront(itemId);
                }} onDragEnd={function () {
                    setDraggingProjectId(null);
                    clearTrashHover();
                }} onDelete={function () { return deleteProject(project.id); }}/>
                </div>);
        })}

            <button type="button" className="dashboard-pen-trigger absolute bottom-12 right-10 z-[220]" onClick={function () { return router.push('/projects/new'); }} aria-label="Создать проект оценки" title="Создать проект оценки">
              <span className="dashboard-pen-body"/>
              <span className="dashboard-pen-cap"/>
              <span className="dashboard-pen-tip"/>
            </button>

            {!folderBuckets.byFolder.length && !folderBuckets.uncategorized.length ? (<div className="absolute inset-x-8 bottom-12 rounded-2xl border border-dashed border-black/10 bg-white/88 p-8 text-center text-sm text-[#4b3727] shadow-[0_14px_30px_-24px_rgba(31,18,10,0.22)]">
                Здесь пока пусто. Создай первый проект или добавь папку в стойку справа.
              </div>) : null}
          </div>
        </div>
      </div>

      {activeFolder ? (<FolderModal folder={activeFolder.folder} projects={activeFolder.projects} busy={busyFolderId === activeFolder.folder.id} onClose={function () { return setActiveFolderId(null); }} onManage={function () { return setFolderActionTarget(activeFolder.folder); }} onOpenProject={function (id) { return router.push("/projects/".concat(id)); }} onMoveToDesktop={function (projectId) { return moveProject(projectId, null); }} onDeleteProject={function (projectId) { return deleteProject(projectId); }}/>) : null}

      {trashOpen ? (<TrashRestoreModal entries={trashEntries} folders={(workspace === null || workspace === void 0 ? void 0 : workspace.folders) || []} projects={(workspace === null || workspace === void 0 ? void 0 : workspace.projects) || []} onClose={function () { return setTrashOpen(false); }} onRestore={restoreTrashEntry} onDeleteNow={function (entry) {
                if (entry.kind === "project")
                    void deleteProject(entry.id, true);
                else
                    void deleteFolderDirect(entry.id);
                setTrashEntries(function (prev) { return prev.filter(function (item) { return !(item.kind === entry.kind && item.id === entry.id); }); });
            }}/>) : null}

      {previewProject ? (<ProjectSheetPreviewModal project={previewProject} onClose={function () { return setPreviewProject(null); }} onOpenFull={function () { return router.push("/projects/".concat(previewProject.id)); }}/>) : null}


      {folderActionTarget ? (<FolderActionDialog folder={folderActionTarget} onClose={function () { return setFolderActionTarget(null); }} onRename={function () { return openRenameFolder(folderActionTarget); }} onDelete={function () { return openDeleteFolder(folderActionTarget); }} onChooseIcon={function () {
                setIconPickerFolder(folderActionTarget);
                setFolderActionTarget(null);
            }}/>) : null}

      {folderRenameTarget ? (<FolderRenameDialog folder={folderRenameTarget} value={folderRenameValue} busy={busyFolderId === folderRenameTarget.id} onChange={setFolderRenameValue} onClose={function () {
                setFolderRenameTarget(null);
                setFolderRenameValue("");
            }} onSave={saveRenameFolder}/>) : null}

      {folderDeleteTarget ? (<FolderDeleteDialog folder={folderDeleteTarget} busy={busyFolderId === folderDeleteTarget.id} onClose={function () { return setFolderDeleteTarget(null); }} onDelete={confirmDeleteFolder}/>) : null}

      {iconPickerFolder ? (<FolderIconPicker folder={iconPickerFolder} busy={busyFolderId === iconPickerFolder.id} onClose={function () { return setIconPickerFolder(null); }} onSelect={function (iconKey) { return updateFolderIcon(iconPickerFolder, iconKey); }}/>) : null}
    </Layout_1.Layout>);
}
function DashboardBackdrop(_a) {
    var pulseToken = _a.pulseToken, greeneryLevel = _a.greeneryLevel;
    return (<>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 dashboard-surface-gradient"/>
        <div className="absolute left-[6%] top-[3%] h-56 w-[42%] rounded-[40px] bg-white/20 blur-3xl"/>
        <div className="absolute right-[4%] top-[6%] h-48 w-[30%] rounded-[40px] bg-white/22 blur-3xl"/>
        <div className="absolute inset-y-0 left-[11%] w-px bg-white/8"/>
        <div className="absolute inset-y-0 left-[42%] w-px bg-black/5"/>
        <div className="absolute inset-y-0 right-[18%] w-px bg-white/7"/>
        <div className="absolute inset-x-0 top-[18%] h-px bg-white/7"/>
        <div className="absolute inset-x-0 top-[53%] h-px bg-black/5"/>
      </div>

      {greeneryLevel >= 1 ? (<div key={"desk-breath-".concat(pulseToken, "-").concat(greeneryLevel)} className="pointer-events-none absolute right-[4%] top-[6%] z-[1] h-40 w-40 rounded-full bg-emerald-200/10 blur-3xl"/>) : null}
    </>);
}
function PremiumActionButton(_a) {
    var label = _a.label, onClick = _a.onClick, pulseToken = _a.pulseToken, _b = _a.variant, variant = _b === void 0 ? "primary" : _b, _c = _a.compact, compact = _c === void 0 ? false : _c;
    return (<button type="button" onClick={onClick} className={"dashboard-action-btn ".concat(variant === "primary" ? "dashboard-action-btn-primary" : "dashboard-action-btn-secondary", " ").concat(compact ? "dashboard-action-btn-compact" : "")}>
      <span className="relative z-10">{label}</span>
      <span className="dashboard-action-badge-shell" aria-hidden="true">
        <SproutBadge key={"".concat(label, "-").concat(pulseToken)} compact={compact}/>
      </span>
    </button>);
}
function SproutBadge(_a) {
    var _b = _a.compact, compact = _b === void 0 ? false : _b;
    var size = compact ? 28 : 32;
    return (<svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true" className="dashboard-button-sprout">
      <circle cx="24" cy="24" r="20" className="dashboard-button-sprout-orb"/>
      <path d="M24 31V18" className="dashboard-button-sprout-stem"/>
      <path d="M24 20C17 15 11 15 7 20C13 23 18 23 24 20Z" className="dashboard-button-sprout-leaf"/>
      <path d="M24 20C30 12 36 10 42 14C37 22 31 24 24 20Z" className="dashboard-button-sprout-leaf dashboard-button-sprout-leaf-alt"/>
    </svg>);
}
function VineLeaf(_a) {
    var x = _a.x, y = _a.y, _b = _a.rotate, rotate = _b === void 0 ? 0 : _b, _c = _a.scale, scale = _c === void 0 ? 1 : _c, _d = _a.className, className = _d === void 0 ? "" : _d;
    return (<path d="M0 0C7 -8 15 -10 24 -2C18 10 8 12 0 0Z" transform={"translate(".concat(x, " ").concat(y, ") rotate(").concat(rotate, ") scale(").concat(scale, ")")} className={"dashboard-vine-leaf ".concat(className).trim()}/>);
}
function VineFrame(_a) {
    var growthLevel = _a.growthLevel, _b = _a.density, density = _b === void 0 ? "rich" : _b, _c = _a.pulseToken, pulseToken = _c === void 0 ? 0 : _c;
    if (growthLevel === 0)
        return null;
    return (<div key={"vines-".concat(density, "-").concat(growthLevel, "-").concat(pulseToken)} className={"dashboard-vine-shell pointer-events-none absolute inset-[10px] z-0 ".concat(density === "rich" ? "opacity-100" : "opacity-90")}>
      <CornerVine className="-left-5 -top-5" growthLevel={growthLevel}/>
      <CornerVine className="-right-5 -top-5 -scale-x-100" growthLevel={growthLevel}/>
      <CornerVine className="-bottom-5 -left-5 -scale-y-100" growthLevel={growthLevel}/>
      <CornerVine className="-bottom-5 -right-5 scale-y-[-1] scale-x-[-1]" growthLevel={growthLevel}/>
      {growthLevel >= 1 ? <EdgeVine side="top" growthLevel={growthLevel}/> : null}
      {growthLevel >= 2 ? <EdgeVine side="right" growthLevel={growthLevel}/> : null}
      {growthLevel >= 3 && density === "rich" ? <EdgeVine side="bottom" growthLevel={growthLevel}/> : null}
    </div>);
}
function CornerVine(_a) {
    var _b = _a.className, className = _b === void 0 ? "" : _b, growthLevel = _a.growthLevel;
    return (<div className={"absolute h-24 w-32 sm:h-28 sm:w-36 ".concat(className)}>
      <svg viewBox="0 0 180 160" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M14 150C28 124 40 104 58 86C78 67 96 54 120 45C136 39 150 26 166 10" className="dashboard-vine-stroke dashboard-vine-stroke-main"/>
        {growthLevel >= 2 ? <path d="M34 148C48 122 58 104 74 89" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/> : null}
        {growthLevel >= 2 ? <path d="M76 86C70 72 60 63 46 59" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/> : null}
        {growthLevel >= 3 ? <path d="M116 45C112 31 102 19 87 12" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/> : null}
        <VineLeaf x={54} y={98} rotate={-34} scale={0.9}/>
        <VineLeaf x={76} y={74} rotate={14} scale={0.95} className="dashboard-vine-leaf-delay"/>
        {growthLevel >= 2 ? <VineLeaf x={98} y={57} rotate={-22} scale={0.82} className="dashboard-vine-leaf-delay"/> : null}
        {growthLevel >= 3 ? <VineLeaf x={126} y={36} rotate={18} scale={0.88} className="dashboard-vine-leaf-delay-2"/> : null}
        {growthLevel >= 4 ? <VineLeaf x={30} y={122} rotate={42} scale={0.76} className="dashboard-vine-leaf-delay-2"/> : null}
      </svg>
    </div>);
}
function EdgeVine(_a) {
    var side = _a.side, growthLevel = _a.growthLevel;
    if (side === "top") {
        return (<div className="absolute left-16 right-16 top-0 h-9 opacity-90">
        <svg viewBox="0 0 360 58" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M8 40C56 18 102 15 154 30C208 45 264 44 352 18" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/>
          <VineLeaf x={72} y={23} rotate={-18} scale={0.84}/>
          <VineLeaf x={122} y={31} rotate={14} scale={0.8} className="dashboard-vine-leaf-delay"/>
          <VineLeaf x={192} y={35} rotate={-10} scale={0.82} className="dashboard-vine-leaf-delay"/>
          {growthLevel >= 2 ? <VineLeaf x={260} y={28} rotate={22} scale={0.86} className="dashboard-vine-leaf-delay-2"/> : null}
          {growthLevel >= 3 ? <VineLeaf x={310} y={20} rotate={-16} scale={0.78} className="dashboard-vine-leaf-delay-2"/> : null}
        </svg>
      </div>);
    }
    if (side === "right") {
        return (<div className="absolute right-0 top-14 bottom-14 w-8 opacity-85">
        <svg viewBox="0 0 48 240" className="h-full w-full" fill="none" aria-hidden="true">
          <path d="M18 10C34 44 34 80 22 116C12 152 13 188 32 230" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/>
          <VineLeaf x={26} y={58} rotate={72} scale={0.88}/>
          <VineLeaf x={12} y={108} rotate={-60} scale={0.86} className="dashboard-vine-leaf-delay"/>
          <VineLeaf x={28} y={162} rotate={64} scale={0.84} className="dashboard-vine-leaf-delay-2"/>
          {growthLevel >= 4 ? <VineLeaf x={16} y={212} rotate={-52} scale={0.78} className="dashboard-vine-leaf-delay-2"/> : null}
        </svg>
      </div>);
    }
    return (<div className="absolute bottom-0 left-20 right-20 h-8 opacity-80">
      <svg viewBox="0 0 360 50" className="h-full w-full" fill="none" aria-hidden="true">
        <path d="M12 12C68 32 130 36 190 25C246 15 300 15 348 32" className="dashboard-vine-stroke dashboard-vine-stroke-soft"/>
        <VineLeaf x={92} y={26} rotate={-12} scale={0.84}/>
        <VineLeaf x={158} y={30} rotate={18} scale={0.84} className="dashboard-vine-leaf-delay"/>
        <VineLeaf x={228} y={22} rotate={-8} scale={0.82} className="dashboard-vine-leaf-delay"/>
        <VineLeaf x={286} y={28} rotate={14} scale={0.86} className="dashboard-vine-leaf-delay-2"/>
      </svg>
    </div>);
}
function FolderDesktopIcon(_a) {
    var _b = _a.variant, variant = _b === void 0 ? "scheme" : _b, folder = _a.folder, projects = _a.projects, busy = _a.busy, onOpen = _a.onOpen, onManage = _a.onManage, onDropProject = _a.onDropProject, draggingProjectId = _a.draggingProjectId, onDragStart = _a.onDragStart, onDragEnd = _a.onDragEnd, _c = _a.sceneEditMode, sceneEditMode = _c === void 0 ? false : _c, _d = _a.selected, selected = _d === void 0 ? false : _d, onSelect = _a.onSelect, onResizeHandleMouseDown = _a.onResizeHandleMouseDown, onRotateHandleMouseDown = _a.onRotateHandleMouseDown, onDragMoveStart = _a.onDragMoveStart;
    var preview = projects.slice(0, 3);
    if (variant === "classic") {
        return (<div className={"group relative flex h-full w-full flex-col items-center ".concat(selected ? "dashboard-desk-entity-selected" : "")}>
        <button type="button" draggable={!sceneEditMode && !busy} onMouseDownCapture={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); }} disabled={busy} onDragStart={function (e) {
                e.dataTransfer.setData("text/folder-id", folder.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
            }} onDragEnd={onDragEnd} onMouseDown={function (e) { if (sceneEditMode)
            onDragMoveStart === null || onDragMoveStart === void 0 ? void 0 : onDragMoveStart(e); }} onClick={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); if (!sceneEditMode)
            onOpen(); }} className={"dashboard-classic-folder ".concat(busy ? "opacity-70" : "")} onDragOver={function (e) { return e.preventDefault(); }} onDrop={function (e) {
                e.preventDefault();
                var draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
                if (draggedId)
                    onDropProject(draggedId);
            }}>
          <span className="dashboard-classic-folder-tab"/>
          <span className="dashboard-classic-folder-body"/>
          <span className="dashboard-classic-folder-count">{projects.length}</span>
        </button>
        <div className="dashboard-classic-icon-label">{folder.name}</div>
        {sceneEditMode && selected ? (<>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть папку">↻</button>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер папки">↘</button>
          </>) : null}
      </div>);
    }
    return (<div className={"group relative flex h-full w-full flex-col items-center gap-2 ".concat(selected ? "dashboard-desk-entity-selected" : "")}>
      <button type="button" draggable={!sceneEditMode && !busy} onMouseDownCapture={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); }} disabled={busy} onDragStart={function (e) {
            e.dataTransfer.setData("text/folder-id", folder.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
        }} onDragEnd={onDragEnd} onMouseDown={function (e) { if (sceneEditMode)
        onDragMoveStart === null || onDragMoveStart === void 0 ? void 0 : onDragMoveStart(e); }} onClick={function () {
            onSelect === null || onSelect === void 0 ? void 0 : onSelect();
            if (!sceneEditMode)
                onOpen();
        }} className={"dashboard-folder-card dashboard-folder-card-angled relative flex h-full w-full items-end justify-start overflow-visible border transition hover:-translate-y-0.5 ".concat(draggingProjectId ? "border-[#94724a]" : "border-[#b88c5a]", " ").concat(busy ? "opacity-70" : "")} onDragOver={function (e) { return e.preventDefault(); }} onDrop={function (e) {
            e.preventDefault();
            var draggedId = e.dataTransfer.getData("text/project-id") || draggingProjectId;
            if (draggedId)
                onDropProject(draggedId);
        }}>
        <div className="dashboard-folder-shadow-strip"/>
        <div className="dashboard-folder-spine"/>
        <div className="dashboard-folder-tab"/>
        <div className="dashboard-folder-pocket"/>
        <div className="dashboard-folder-mouth"/>
        <div className="dashboard-folder-inner-shadow"/>
        <div className="dashboard-folder-gloss"/>

        <div className="absolute left-4 right-12 top-10 z-20">
          <div className="truncate text-[16px] font-semibold leading-tight text-[#5c3e1f]">{folder.name}</div>
          <div className="mt-1 text-[11px] text-[#7a5830]">Открыть папку</div>
        </div>

        <div className="pointer-events-none absolute left-4 right-4 top-[68px] z-20 flex flex-col gap-1.5">
          {preview.length ? preview.map(function (project, index) {
            var _a;
            var slipTitle = ((_a = project.person) === null || _a === void 0 ? void 0 : _a.full_name) || project.title || "Проект";
            return (<div key={project.id} className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm" style={{
                    marginLeft: "".concat(index * 10, "px"),
                    marginRight: "".concat(Math.max(0, 20 - index * 5), "px"),
                    transform: "translateY(".concat(index * 8, "px) rotate(").concat(index % 2 === 0 ? -0.8 : 0.65, "deg)"),
                    zIndex: 30 - index,
                }}>
                <span className="block truncate">{slipTitle}</span>
              </div>);
        }) : (<div className="dashboard-folder-name-slip rounded-[8px] border px-3 py-1 text-left text-[10px] font-semibold shadow-sm">
              <span className="block truncate">Папка пуста</span>
            </div>)}
        </div>

        <div className="absolute bottom-3 right-4 z-20 rounded-full border border-[#d5be99] bg-[#fff9f0]/92 px-2 py-1 text-[11px] font-medium text-[#5b4024] shadow-sm">{projects.length}</div>
      </button>
      <button type="button" onClick={onManage} className="absolute right-0 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#f2e7d3] bg-[#fffaf2]/96 text-sm text-[#6e4d2f] shadow-sm opacity-0 transition hover:text-slate-900 group-hover:opacity-100" title="Управление папкой" aria-label="Управление папкой">
        ⋯
      </button>
      {sceneEditMode && selected ? (<>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть папку">↻</button>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер папки">↘</button>
        </>) : null}
    </div>);
}
function ProjectDesktopIcon(_a) {
    var _b, _c, _d;
    var _e = _a.variant, variant = _e === void 0 ? "scheme" : _e, project = _a.project, onOpen = _a.onOpen, onDragStart = _a.onDragStart, onDragEnd = _a.onDragEnd, onDelete = _a.onDelete, _f = _a.busy, busy = _f === void 0 ? false : _f, _g = _a.compact, compact = _g === void 0 ? false : _g, _h = _a.sceneEditMode, sceneEditMode = _h === void 0 ? false : _h, _j = _a.selected, selected = _j === void 0 ? false : _j, onSelect = _a.onSelect, onResizeHandleMouseDown = _a.onResizeHandleMouseDown, onRotateHandleMouseDown = _a.onRotateHandleMouseDown, onDragMoveStart = _a.onDragMoveStart;
    var displayName = ((_b = project.person) === null || _b === void 0 ? void 0 : _b.full_name) || project.title || "Проект";
    var titleLine = project.title || displayName;
    var roleLine = project.target_role || ((_c = project.person) === null || _c === void 0 ? void 0 : _c.current_position) || "Роль не указана";
    var goal = (0, commercialGoals_1.getGoalDefinition)(project.goal);
    var total = ((_d = project.tests) === null || _d === void 0 ? void 0 : _d.length) || 0;
    var completed = Math.min(project.attempts_count || 0, total || 0);
    var isDone = total > 0 && completed >= total;
    var assessmentLine = isDone ? "сформирована" : completed > 0 ? "в процессе" : "ещё не собрана";
    if (variant === "classic") {
        return (<div className={"group relative h-full w-full ".concat(selected ? "dashboard-desk-entity-selected" : "")}>
        <button type="button" draggable={!sceneEditMode && !busy} disabled={busy} onMouseDownCapture={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); }} onDragStart={function (e) {
                e.dataTransfer.setData("text/project-id", project.id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
            }} onDragEnd={onDragEnd} onMouseDown={function (e) { if (sceneEditMode)
            onDragMoveStart === null || onDragMoveStart === void 0 ? void 0 : onDragMoveStart(e); }} onClick={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); if (!sceneEditMode)
            onOpen(); }} className={"dashboard-classic-file ".concat(busy ? "opacity-60" : "")}>
          <span className="dashboard-classic-file-paper"/>
          <span className="dashboard-classic-file-corner"/>
          <span className={"dashboard-classic-file-dot ".concat(isDone ? "dashboard-classic-file-dot-done" : "dashboard-classic-file-dot-pending")}></span>
        </button>
        <div className="dashboard-classic-icon-label">{titleLine}</div>
        {sceneEditMode && selected ? (<>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть файл">↻</button>
            <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер файла">↘</button>
          </>) : null}
      </div>);
    }
    return (<div className={"group relative h-full w-full dashboard-desk-sheet-wrap ".concat(selected ? "dashboard-desk-entity-selected" : "")}>
      {onDelete ? (<button type="button" onClick={function (e) {
                e.stopPropagation();
                onDelete();
            }} className="dashboard-desk-sheet-delete" title="Удалить проект" aria-label="Удалить проект">
          ✕
        </button>) : null}
      <button type="button" draggable={!sceneEditMode && !busy} disabled={busy} onMouseDownCapture={function () { onSelect === null || onSelect === void 0 ? void 0 : onSelect(); }} onDragStart={function (e) {
            e.dataTransfer.setData("text/project-id", project.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
        }} onDragEnd={onDragEnd} onMouseDown={function (e) { if (sceneEditMode)
        onDragMoveStart === null || onDragMoveStart === void 0 ? void 0 : onDragMoveStart(e); }} onClick={function () {
            onSelect === null || onSelect === void 0 ? void 0 : onSelect();
            if (!sceneEditMode)
                onOpen();
        }} className={"dashboard-desk-sheet dashboard-desk-sheet-plain ".concat(compact ? "dashboard-desk-sheet-compact" : "", " ").concat(busy ? "opacity-60" : "")}>
        <span className="dashboard-desk-sheet-clip" aria-hidden="true"/>
        <span className="dashboard-desk-sheet-kicker">Лист проекта</span>
        <span className="dashboard-desk-sheet-title">{titleLine}</span>
        <span className="dashboard-desk-sheet-row"><span>Имя</span><strong>{displayName}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Цель</span><strong>{(goal === null || goal === void 0 ? void 0 : goal.shortTitle) || project.goal}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Роль</span><strong>{roleLine}</strong></span>
        <span className="dashboard-desk-sheet-row"><span>Оценка</span><strong>{assessmentLine}</strong></span>
        <span className="dashboard-desk-sheet-footer">
          <span>{completed}/{total || 0} тестов</span>
          <span>{new Date(project.created_at).toLocaleDateString("ru-RU")}</span>
        </span>
        <span className={"dashboard-desk-sheet-stamp ".concat(isDone ? "dashboard-desk-sheet-stamp-done" : "dashboard-desk-sheet-stamp-pending")}>{isDone ? "ЗАВЕРШЕНО" : "НЕ ЗАВЕРШЕНО"}</span>
      </button>
      {sceneEditMode && selected ? (<>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-rotate" onMouseDown={onRotateHandleMouseDown} aria-label="Повернуть лист">↻</button>
          <button type="button" className="dashboard-desk-entity-handle dashboard-desk-entity-resize" onMouseDown={onResizeHandleMouseDown} aria-label="Изменить размер листа">↘</button>
        </>) : null}
    </div>);
}
function ProjectSheetPreviewModal(_a) {
    var _b, _c, _d, _e, _f, _g;
    var project = _a.project, onClose = _a.onClose, onOpenFull = _a.onOpenFull;
    var displayName = ((_b = project.person) === null || _b === void 0 ? void 0 : _b.full_name) || project.title || "Проект";
    var goal = (0, commercialGoals_1.getGoalDefinition)(project.goal);
    var total = ((_c = project.tests) === null || _c === void 0 ? void 0 : _c.length) || 0;
    var completed = Math.min(project.attempts_count || 0, total || 0);
    var isDone = total > 0 && completed >= total;
    var assessmentLine = isDone ? "Общая оценка сформирована" : completed > 0 ? "Общая оценка в процессе" : "Общая оценка ещё не собрана";
    var roleLine = project.target_role || ((_d = project.person) === null || _d === void 0 ? void 0 : _d.current_position) || "Не указана";
    return (<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="dashboard-project-preview-wrap relative w-full max-w-[920px]" onClick={function (e) { return e.stopPropagation(); }}>
        <button type="button" className="absolute right-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/92 text-lg text-slate-700 shadow-lg hover:text-slate-950" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>

        <div className="dashboard-project-preview-board">
          <div className="dashboard-project-preview-clip" aria-hidden="true"/>
          <div className="dashboard-project-preview-clip-inner" aria-hidden="true"/>

          <div className="dashboard-project-preview-sheet">
            <div className="dashboard-project-preview-topline">
              <div>
                <div className="dashboard-project-preview-kicker">Лист проекта оценки</div>
                <div className="dashboard-project-preview-title">{project.title || displayName}</div>
              </div>
              <div className={"dashboard-project-preview-stamp ".concat(isDone ? "dashboard-project-preview-stamp-ready" : "dashboard-project-preview-stamp-progress")}>
                {assessmentLine}
              </div>
            </div>

            <div className="dashboard-project-preview-columns">
              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Карточка участника</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Имя и фамилия</span><strong>{displayName}</strong></div>
                  <div><span>Email</span><strong>{((_e = project.person) === null || _e === void 0 ? void 0 : _e.email) || "Не указан"}</strong></div>
                  <div><span>Текущая должность</span><strong>{((_f = project.person) === null || _f === void 0 ? void 0 : _f.current_position) || "Не указана"}</strong></div>
                  <div><span>Целевая роль</span><strong>{roleLine}</strong></div>
                  <div><span>Цель оценки</span><strong>{(goal === null || goal === void 0 ? void 0 : goal.title) || (goal === null || goal === void 0 ? void 0 : goal.shortTitle) || project.goal}</strong></div>
                  <div><span>Создан</span><strong>{new Date(project.created_at).toLocaleString("ru-RU")}</strong></div>
                </div>
              </div>

              <div className="dashboard-project-preview-section">
                <div className="dashboard-project-preview-section-title">Сводка по проекту</div>
                <div className="dashboard-project-preview-table">
                  <div><span>Статус</span><strong>{assessmentLine}</strong></div>
                  <div><span>Тестов в наборе</span><strong>{total}</strong></div>
                  <div><span>Завершено попыток</span><strong>{completed}</strong></div>
                  <div><span>Пакет</span><strong>{project.package_mode || "standard"}</strong></div>
                </div>

                <div className="dashboard-project-preview-tests">
                  <div className="dashboard-project-preview-section-title">Инструменты в проекте</div>
                  {((_g = project.tests) === null || _g === void 0 ? void 0 : _g.length) ? (<ul>
                      {project.tests
                .slice()
                .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
                .map(function (test) { return (<li key={"".concat(project.id, "-").concat(test.test_slug)}>{test.test_title || test.test_slug}</li>); })}
                    </ul>) : (<div className="text-sm text-slate-500">Тесты пока не добавлены.</div>)}
                </div>
              </div>
            </div>

            <div className="dashboard-project-preview-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть лист</button>
              <button type="button" className="btn btn-primary" onClick={onOpenFull}>Открыть проект полностью</button>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
function FolderModal(_a) {
    var folder = _a.folder, projects = _a.projects, busy = _a.busy, onClose = _a.onClose, onManage = _a.onManage, onOpenProject = _a.onOpenProject, onMoveToDesktop = _a.onMoveToDesktop, onDeleteProject = _a.onDeleteProject;
    var _b = (0, react_1.useState)(null), draggingInnerProjectId = _b[0], setDraggingInnerProjectId = _b[1];
    var icon = (0, folderIcons_1.getFolderIcon)(folder.icon_key);
    return (<div className={"fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm ".concat(draggingInnerProjectId ? "ring-4 ring-emerald-300/50" : "")} onClick={onClose} onDragOver={function (e) {
            if (draggingInnerProjectId)
                e.preventDefault();
        }} onDrop={function (e) {
            var draggedId = e.dataTransfer.getData("text/project-id") || draggingInnerProjectId;
            if (!draggedId)
                return;
            e.preventDefault();
            e.stopPropagation();
            setDraggingInnerProjectId(null);
            onMoveToDesktop(draggedId);
        }}>
      <div className="w-full max-w-5xl rounded-[32px] border border-[#b68b58] bg-[#f8f0e3]/95 p-5 shadow-2xl" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className={"flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br text-3xl shadow-sm ".concat(icon.tileClass)}>{icon.symbol}</div>
            <div>
              <div className="text-sm text-slate-500">Папка</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
              <div className="mt-1 text-sm text-slate-500">Открой проект как иконку или просто перетащи её за пределы окна папки, чтобы вернуть на рабочий стол.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onManage} className="btn btn-secondary btn-sm">Управление</button>
            <button type="button" onClick={onClose} className="btn btn-primary btn-sm">Закрыть</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900">
          Рабочий стол снаружи этого окна. Потяни иконку проекта на затемнённый фон, и она вернётся из папки обратно на стол.
        </div>

        <div className={"mt-6 rounded-[28px] border border-emerald-100 bg-white p-4 ".concat(busy ? "opacity-70" : "")}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {projects.length ? (projects.map(function (project) { return (<ProjectDesktopIcon key={project.id} project={project} compact busy={busy} onOpen={function () { return onOpenProject(project.id); }} onDragStart={function () { return setDraggingInnerProjectId(project.id); }} onDragEnd={function () { return setDraggingInnerProjectId(null); }} onDelete={onDeleteProject ? function () { return onDeleteProject(project.id); } : undefined}/>); })) : (<div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
                Папка пока пустая. Перетащи на неё проекты с рабочего стола.
              </div>)}
          </div>
        </div>
      </div>
    </div>);
}
function FolderActionDialog(_a) {
    var folder = _a.folder, onClose = _a.onClose, onRename = _a.onRename, onDelete = _a.onDelete, onChooseIcon = _a.onChooseIcon;
    return (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="text-sm text-slate-500">Управление папкой</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn btn-secondary justify-start" onClick={onRename}>Переименовать</button>
          <button type="button" className="btn btn-secondary justify-start" onClick={onChooseIcon}>Сменить иконку</button>
          <button type="button" className="btn btn-secondary justify-start text-red-600 hover:text-red-700" onClick={onDelete}>Удалить папку</button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>);
}
function FolderRenameDialog(_a) {
    var folder = _a.folder, value = _a.value, busy = _a.busy, onChange = _a.onChange, onClose = _a.onClose, onSave = _a.onSave;
    return (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="text-sm text-slate-500">Переименование папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">Новое название</label>
          <input className="input mt-2 w-full" value={value} onChange={function (e) { return onChange(e.target.value); }} placeholder="Введите название папки" onKeyDown={function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                onSave();
            }
        }} autoFocus/>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={busy || !value.trim()}>{busy ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </div>
    </div>);
}
function FolderDeleteDialog(_a) {
    var folder = _a.folder, busy = _a.busy, onClose = _a.onClose, onDelete = _a.onDelete;
    return (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-5 shadow-2xl" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="text-sm text-slate-500">Удаление папки</div>
        <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
        <div className="mt-4 text-sm leading-6 text-slate-600">Проекты из папки вернутся на рабочий стол. Сама папка будет удалена.</div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary btn-sm bg-rose-600 hover:bg-rose-700 border-rose-600" onClick={onDelete} disabled={busy}>{busy ? "Удаляем…" : "Удалить"}</button>
        </div>
      </div>
    </div>);
}
function FolderIconPicker(_a) {
    var folder = _a.folder, busy = _a.busy, onClose = _a.onClose, onSelect = _a.onSelect;
    var active = (0, folderIcons_1.getFolderIcon)(folder.icon_key);
    return (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[28px] border border-emerald-200 bg-white p-5 shadow-2xl" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Иконка папки</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{folder.name}</div>
            <div className="mt-1 text-sm text-slate-500">Выбери минимальную иконку — папка на рабочем столе полностью сменится на неё.</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Закрыть</button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3">
          <div className={"flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ".concat(active.tileClass)}>{active.symbol}</div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Сейчас: {active.label}</div>
            <div className="text-xs text-slate-500">Иконка влияет только на вид папки на рабочем столе.</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {folderIcons_1.FOLDER_ICONS.map(function (icon) {
            var selected = active.key === icon.key;
            return (<button key={icon.key} type="button" onClick={function () { return onSelect(icon.key); }} disabled={busy} className={"rounded-[22px] border p-3 text-left transition ".concat(selected ? "border-transparent ring-2 ".concat(icon.ringClass) : "border-emerald-100 hover:border-emerald-200", " ").concat(busy ? "opacity-70" : "")}>
                <div className={"flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br text-2xl shadow-sm ".concat(icon.tileClass)}>{icon.symbol}</div>
                <div className="mt-3 text-sm font-medium text-slate-900">{icon.label}</div>
              </button>);
        })}
        </div>
      </div>
    </div>);
}
function TrashRestoreModal(_a) {
    var entries = _a.entries, onClose = _a.onClose, onRestore = _a.onRestore, onDeleteNow = _a.onDeleteNow;
    return (<div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-[760px] rounded-[28px] border border-[#dac4a7] bg-[#fffaf2] p-5 shadow-[0_30px_70px_-44px_rgba(53,34,17,0.38)]" onClick={function (e) { return e.stopPropagation(); }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#5a3b20]">Корзина</div>
            <div className="text-sm text-[#84664a]">Папки и проекты можно восстановить в течение 3 суток.</div>
          </div>
          <button type="button" className="rounded-full border border-[#d9c6ab] bg-white px-4 py-2 text-sm text-[#5a3b20]" onClick={onClose}>Закрыть</button>
        </div>
        <div className="space-y-3">
          {entries.length ? entries.map(function (entry) {
            var remaining = Math.max(0, entry.expiresAt - Date.now());
            var hours = Math.ceil(remaining / (60 * 60 * 1000));
            return (<div key={"".concat(entry.kind, ":").concat(entry.id)} className="rounded-[20px] border border-[#e3d0b2] bg-white/92 p-4 shadow-[0_12px_26px_-22px_rgba(53,34,17,0.28)] dashboard-trash-item-crumpled">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-[#a2835d]">{entry.kind === 'folder' ? 'Папка' : 'Проект'}</div>
                    <div className="mt-1 text-base font-semibold text-[#51361e]">{entry.title}</div>
                    <div className="mt-1 text-sm text-[#7b5f44]">Удалится через ~{hours} ч.</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-full border border-[#cfe1d0] bg-[#eaf7ea] px-4 py-2 text-sm font-medium text-[#335a36]" onClick={function () { return onRestore(entry); }}>Восстановить</button>
                    <button type="button" className="rounded-full border border-[#e6c5c5] bg-[#fff2f2] px-4 py-2 text-sm font-medium text-[#8a3f3f]" onClick={function () { return onDeleteNow(entry); }}>Удалить сейчас</button>
                  </div>
                </div>
              </div>);
        }) : <div className="rounded-[20px] border border-dashed border-[#dbc9ac] bg-white/80 p-8 text-center text-sm text-[#84664a]">Корзина пуста.</div>}
        </div>
      </div>
    </div>);
}
