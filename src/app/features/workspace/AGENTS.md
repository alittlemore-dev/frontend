# Personal Workspace Navigation

- Give each entity type or workspace tool one primary page and one sidebar entry. Add related
  views and capabilities as tabs on that page, rather than as separate peer pages or sidebar
  sections. For example, a people calendar belongs on the People page; finance overview,
  operations, and analytics belong on the Financial Tracker page.
- Keep routes for individual records and their editors when they identify a distinct record.
  Do not use those detail routes to split related views of the same record or tool into peer pages.
- Organize sidebar entries by their broader purpose. The Financial Tracker belongs in Working
  Area beside Resumes, with no separate Finance group or Statistics sidebar entry.
- Use one clear tab row within a tool. Separate groups of related tabs with a subtle divider and
  a concise localized label when needed; avoid nested navigation for equivalent peer views.
- Share contextual selection across related tabs. Finance overview, operations, and monthly
  statistics use the same selected month and previous/current/next month controls. Identify the
  concrete month and year; call the monthly analytics period Month rather than This month.
- Keep tabs and contextual filters bookmarkable. Preserve old links through redirects when
  consolidating pages, and protect authored drafts during month or page navigation.
- Use the tracker’s category rows for editable overview amounts, transaction controls for entries
  and history, and its shared chart and filter components for statistics. Compare corresponding
  fields in the rendered income, expense and asset forms. Use `ds-site-select` for single-choice
  fields, including inline creation and expanded settings. Verify keyboard selection and that the
  selected value survives saving and reopening. Compare populated overview rows at desktop and
  mobile widths. Keep the name and editable amount on one line and make secondary details
  available on demand. When an operation depends on the asset type, let the owner select the
  asset before offering the applicable actions. Keep save, archive and restore interactions aligned.
- Format visible finance dates, months and timestamps with the existing locale-aware helpers,
  including chart labels, revision history and date ranges. Preserve plain dates across time zones.
- Monthly finance analytics show one report in the selected reporting currency (the selected
  month's currency by default). The previous month is comparison data, not another report block.
  Use existing stored-rate conversion contracts; never sum incompatible currencies directly.
- Preserve chart and numeric-list alignment between side-by-side income/expense analytics columns.
- These rules apply only to Personal Workspace. Do not apply this consolidation policy to the
  admin panel or reorganize other existing tools without a task that authorizes that work.
