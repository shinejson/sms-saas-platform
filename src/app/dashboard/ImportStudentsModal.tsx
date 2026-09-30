import React from 'react';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
  summary: { withDateOfBirth: number; withClass: number; withGuardian: number };
}

interface ImportTemplate {
  csvHeaders: string[];
  exampleRow: Record<string, string>;
  validationRules: Record<string, string>;
  availableClasses: Array<{ id: string; name: string }>;
}

interface ImportStudentsModalProps {
  showModal: boolean;
  onClose: () => void;
  importPayload: string;
  setImportPayload: (value: string) => void;
  importLoading: boolean;
  importResult: ImportResult | null;
  importTemplate: ImportTemplate | null;
  onSubmit: (e: React.FormEvent) => void;
  onFileUpload: (file: File) => void;
  onDownloadTemplate: () => void;
}

export default function ImportStudentsModal({
  showModal,
  onClose,
  importPayload,
  setImportPayload,
  importLoading,
  importResult,
  importTemplate,
  onSubmit,
  onFileUpload,
  onDownloadTemplate,
}: ImportStudentsModalProps) {
  if (!showModal) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Import Students</h3>
            <p className="text-xs text-slate-500">Bulk import students from JSON data with validation</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Error Display */}
        {importResult && !importResult.success && importResult.errors.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 max-h-48 overflow-y-auto">
            <h4 className="text-xs font-bold text-red-800 mb-2">
              Validation Errors ({importResult.errors.length})
            </h4>
            <div className="space-y-1">
              {importResult.errors.slice(0, 20).map((err, idx) => (
                <div key={idx} className="text-xs text-red-700">
                  Row {err.row}: {err.field} — {err.message}
                </div>
              ))}
              {importResult.errors.length > 20 && (
                <div className="text-xs text-red-600 italic">
                  ... and {importResult.errors.length - 20} more errors
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Display */}
        {importResult && importResult.success && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <h4 className="text-sm font-bold text-emerald-800">Import Successful!</h4>
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs text-emerald-700">
              <div className="text-center">
                <p className="font-bold text-lg">{importResult.totalRows}</p>
                <p className="opacity-75">Total Rows</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-emerald-600">{importResult.imported}</p>
                <p className="opacity-75">Imported</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-amber-600">{importResult.skipped}</p>
                <p className="opacity-75">Skipped</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-blue-600">{importResult.summary.withGuardian}</p>
                <p className="opacity-75">With Guardian</p>
              </div>
            </div>
          </div>
        )}

        {/* Template Reference */}
        {importTemplate && !importResult?.success && (
          <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-blue-900">Download Excel Template</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Use our template to prepare your student data
                </p>
              </div>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Template
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[10px] text-blue-700">
              <div>
                <p className="font-semibold mb-1">Required Fields:</p>
                <code className="bg-white px-1.5 py-0.5 rounded">studentId, firstName, lastName</code>
              </div>
              <div>
                <p className="font-semibold mb-1">Available Classes:</p>
                <code className="bg-white px-1.5 py-0.5 rounded">
                  {importTemplate.availableClasses.length > 0
                    ? importTemplate.availableClasses.map((c) => c.name).slice(0, 3).join(', ')
                    : 'No classes yet'}
                </code>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* File Upload Section */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors">
            <input
              type="file"
              id="excel-upload"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={importLoading}
            />
            <label htmlFor="excel-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Click to upload Excel file
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports .xlsx and .xls files (Max 500 students)
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Browse Files
                </button>
              </div>
            </label>
          </div>

          {/* JSON Preview (if data loaded) */}
          {importPayload && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Loaded Data Preview
                </label>
                <button
                  type="button"
                  onClick={() => setImportPayload('')}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear Data
                </button>
              </div>
              <textarea
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                rows={8}
                readOnly
              />
              <p className="text-xs text-slate-500 mt-1">
                {JSON.parse(importPayload).length} student(s) ready to import
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importLoading || !importPayload}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-sm flex items-center gap-2"
            >
              {importLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Import Students
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
