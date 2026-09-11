import React, { useEffect, useState } from "react";
import { getAdminAuditLogs } from "../../../api/api";
import Pagination from "../../../components/Pagination";
import { SetLoadingStatus } from "../../../actions/appActions";

type AuditRow = {
    _id: string;
    actorEmail?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    targetEmail?: string;
    meta?: Record<string, unknown>;
    createdAt?: string;
};

const PAGE_SIZE = 25;

function metaSummary(meta?: Record<string, unknown>): string {
    if (!meta || typeof meta !== "object") return "—";
    try {
        const keys = Object.keys(meta);
        if (!keys.length) return "—";
        const preferred = ["from", "to", "role", "amount", "reason", "target", "sources", "targetRole"];
        const parts: string[] = [];
        for (const k of preferred) {
            if (meta[k] !== undefined && meta[k] !== null) {
                const v = Array.isArray(meta[k]) ? (meta[k] as unknown[]).join(", ") : String(meta[k]);
                parts.push(`${k}=${v}`);
            }
        }
        if (!parts.length) {
            return keys
                .slice(0, 3)
                .map((k) => `${k}=${String(meta[k])}`)
                .join("; ");
        }
        return parts.join("; ");
    } catch {
        return "—";
    }
}

export default function AdminAuditLog() {
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPage, setTotalPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loaded, setLoaded] = useState(false);

    const load = async (page: number) => {
        try {
            SetLoadingStatus(true);
            setCurrentPage(page);
            const res = await getAdminAuditLogs({ numPerPage: PAGE_SIZE, currentPage: page });
            const list = Array.isArray(res?.result) ? res.result : [];
            setRows(list);
            const total = res?.totalCount || 0;
            setTotalCount(total);
            const pages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE) - 1;
            setTotalPage(pages < 0 ? 0 : pages);
        } catch (err) {
            console.error(err);
            setRows([]);
            setTotalCount(0);
            setTotalPage(0);
        } finally {
            setLoaded(true);
            SetLoadingStatus(false);
        }
    };

    useEffect(() => {
        load(0);
    }, []);

    return (
        <div className="w-full min-h-full bg-wl-page text-wl-ink px-[18px] pt-10 pb-10">
            <div className="mx-auto max-w-[1200px]">
                <h2 className="text-2xl font-semibold text-wl-brand mb-1">Audit log</h2>
                <p className="text-sm text-wl-muted mb-6">
                    Recent admin actions across the portal ({totalCount} total).
                </p>

                <div className="overflow-x-auto rounded-2xl border border-wl-line bg-white shadow-sm">
                    {!loaded ? (
                        <p className="p-8 text-center text-sm text-wl-muted">Loading…</p>
                    ) : rows.length === 0 ? (
                        <p className="p-8 text-center text-sm text-wl-muted">No audit events yet.</p>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-wl-brandSoft text-wl-brand">
                                <tr>
                                    <th className="px-4 py-3">Time</th>
                                    <th className="px-4 py-3">Actor</th>
                                    <th className="px-4 py-3">Action</th>
                                    <th className="px-4 py-3">Target</th>
                                    <th className="px-4 py-3">Meta</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row._id} className="border-b border-wl-line hover:bg-wl-pageAlt">
                                        <td className="px-4 py-2 whitespace-nowrap text-wl-muted">
                                            {row.createdAt
                                                ? new Date(row.createdAt).toLocaleString()
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-2">{row.actorEmail || "—"}</td>
                                        <td className="px-4 py-2 font-medium text-wl-brand">{row.action}</td>
                                        <td className="px-4 py-2">
                                            <div>{row.targetEmail || row.targetId || "—"}</div>
                                            {row.targetType ? (
                                                <div className="text-xs text-wl-muted">{row.targetType}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-wl-muted max-w-[280px] break-words">
                                            {metaSummary(row.meta)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {totalCount > PAGE_SIZE ? (
                    <div className="mt-4 flex justify-center">
                        <Pagination
                            currentPage={currentPage}
                            totalPage={totalPage}
                            goPrev={() => load(Math.max(0, currentPage - 1))}
                            goNext={() => load(Math.min(totalPage, currentPage + 1))}
                            goFirst={() => load(0)}
                            goLast={() => load(totalPage)}
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
