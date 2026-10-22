const {
    normalizeAudience,
    requestClientMeta,
    previewTermsVersion,
    publishTermsVersion,
    listVersionMetas,
    getVersionDocument,
    safeDownloadName,
    listSigners,
    searchTermsUsers,
    listAcceptancesForUser,
    listRequiredContracts,
    getVisibleCurrent,
    acceptTermsForUser,
    getCurrentSharedPublic,
} = require("../services/termsAgreement");

function sendTermsError(res: any, err: any) {
    const status = Number(err?.status) || 500;
    if (status >= 500) console.error("[terms]", err);
    const error = status >= 500
        ? "Something went wrong. Please try again."
        : (err?.publicMessage || err?.message || "Could not complete that request.");
    return res.status(status).json({ error });
}

function readDocx(req: any) {
    const file = req.file;
    const name = String(file?.originalname || "");
    if (!file?.buffer?.length || !name.toLowerCase().endsWith(".docx")) {
        const err: any = new Error("Upload a .docx file.");
        err.status = 400;
        err.publicMessage = "Upload a .docx file.";
        throw err;
    }
    return file;
}

const previewTerms = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        if (!audience) return res.status(400).json({ error: "Unknown agreement audience." });
        const file = readDocx(req);
        const preview = await previewTermsVersion({ audience, buffer: file.buffer });
        return res.status(200).json(preview);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const publishTerms = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        if (!audience) return res.status(400).json({ error: "Unknown agreement audience." });
        const file = readDocx(req);
        const published = await publishTermsVersion({
            audience,
            buffer: file.buffer,
            filename: file.originalname,
            publisherId: req.user.userId,
        });
        return res.status(201).json(published);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const listTermsVersions = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        if (!audience) return res.status(400).json({ error: "Unknown agreement audience." });
        const versions = await listVersionMetas(audience);
        return res.status(200).json({ audience, versions });
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const getTermsVersion = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        const version = Number(req.params.version);
        if (!audience || !Number.isInteger(version)) {
            return res.status(400).json({ error: "Unknown agreement version." });
        }
        const doc = await getVersionDocument(audience, version, false);
        return res.status(200).json({
            audience: doc.audience,
            version: doc.version,
            html: doc.html,
            contentHash: doc.contentHash,
            originalFilename: doc.originalFilename,
            publishedAt: doc.publishedAt,
            docxSha256: doc.docxSha256,
        });
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const downloadTermsDocx = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        const version = Number(req.params.version);
        if (!audience || !Number.isInteger(version)) {
            return res.status(400).json({ error: "Unknown agreement version." });
        }
        const doc = await getVersionDocument(audience, version, true);
        const filename = safeDownloadName(doc.originalFilename, audience, version);
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(doc.docx);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const listVersionAcceptances = async (req: any, res: any) => {
    try {
        const audience = normalizeAudience(req.params.audience);
        const version = Number(req.params.version);
        if (!audience || !Number.isInteger(version)) {
            return res.status(400).json({ error: "Unknown agreement version." });
        }
        const result = await listSigners(audience, version);
        return res.status(200).json(result);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const searchTermsUsersHandler = async (req: any, res: any) => {
    try {
        const users = await searchTermsUsers(req.query.q);
        return res.status(200).json({ users });
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const getUserTermsAcceptances = async (req: any, res: any) => {
    try {
        const result = await listAcceptancesForUser(req.params.userId);
        return res.status(200).json(result);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const getCurrentSharedTerms = async (_req: any, res: any) => {
    try {
        const current = await getCurrentSharedPublic();
        return res.status(200).json(current);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const getRequiredTerms = async (req: any, res: any) => {
    try {
        const contracts = await listRequiredContracts(req.user);
        return res.status(200).json({ contracts });
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const getCurrentTerms = async (req: any, res: any) => {
    try {
        const current = await getVisibleCurrent(req.user, req.params.audience);
        return res.status(200).json(current);
    } catch (err) {
        return sendTermsError(res, err);
    }
};

const acceptTerms = async (req: any, res: any) => {
    try {
        const result = await acceptTermsForUser({
            userId: req.user.userId,
            role: req.user.role,
            body: req.body || {},
            meta: requestClientMeta(req),
        });
        return res.status(200).json({
            status: "SUCCESS",
            alreadyAccepted: !!result.alreadyAccepted,
        });
    } catch (err) {
        return sendTermsError(res, err);
    }
};

module.exports = {
    previewTerms,
    publishTerms,
    listTermsVersions,
    getTermsVersion,
    downloadTermsDocx,
    listVersionAcceptances,
    searchTermsUsersHandler,
    getUserTermsAcceptances,
    getCurrentSharedTerms,
    getRequiredTerms,
    getCurrentTerms,
    acceptTerms,
};
