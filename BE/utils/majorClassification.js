const Keyword = require("../models/Keyword");
const { isBaselineMajor } = require("../constants/majorOptions");

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const classifyMajors = async (keywords) => {
    const officialIds = [];
    const customValues = [];
    if (!Array.isArray(keywords)) return { officialIds, customValues };

    for (let i = 0; i < keywords.length; i++) {
        const raw = typeof keywords[i] === "string" ? keywords[i] : keywords[i] && keywords[i].value;
        const value = String(raw || "").trim();
        if (!value) continue;

        const existing = await Keyword.findOne({
            value: { $regex: new RegExp(`^${escapeRegExp(value)}$`, "i") },
        });

        if (existing) {
            if (!officialIds.some((id) => String(id) === String(existing._id))) {
                officialIds.push(existing._id);
            }
        } else if (isBaselineMajor(value)) {
            const created = await Keyword.create({ value, label: value });
            officialIds.push(created._id);
        } else if (!customValues.some((v) => v.toLowerCase() === value.toLowerCase())) {
            customValues.push(value);
        }
    }

    return { officialIds, customValues };
};

module.exports = { classifyMajors };
