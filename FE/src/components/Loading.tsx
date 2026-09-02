import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface LoadingProps {
  loading: boolean;
}

export default function Loading({ loading }: LoadingProps) {

    useEffect(() => {
        if (loading) {
            document.getElementsByTagName('body')[0].classList.add('overflow-hidden')
        } else {
            document.getElementsByTagName('body')[0].classList.remove('overflow-hidden')
        }
    }, [loading])

    return loading
        ? createPortal(
            <div className="fixed inset-0 z-[10000000] flex items-center justify-center bg-black/45">
              <div className="flex flex-col items-center gap-3 text-sm text-white">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <svg
                    className="h-10 w-10 animate-spin-slow text-[#234C6A]"
                    viewBox="0 0 64 64"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <clipPath id="globe-clip">
                        <circle cx="32" cy="32" r="16" />
                      </clipPath>
                    </defs>
                    <circle
                      cx="32"
                      cy="32"
                      r="16"
                      className="stroke-current"
                      strokeWidth="2"
                      fill="none"
                    />
                    <g clipPath="url(#globe-clip)" className="fill-current">
                      <ellipse cx="32" cy="32" rx="16" ry="6" opacity="0.35" />
                      <ellipse cx="32" cy="24" rx="16" ry="6" opacity="0.25" />
                      <ellipse cx="32" cy="40" rx="16" ry="6" opacity="0.25" />
                      <path
                        d="M32 16c-5 4-8 10-8 16s3 12 8 16c5-4 8-10 8-16s-3-12-8-16z"
                        opacity="0.5"
                      />
                    </g>
                  </svg>
                </div>
                <span className="text-xs font-medium tracking-wide text-slate-100">
                  Loading your experience…
                </span>
              </div>
              <style>{`
                @keyframes spin-slow {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                  animation: spin-slow 1.6s linear infinite;
                }
              `}</style>
            </div>,
            document.getElementsByTagName('body')[0]
          )
        : null;
}