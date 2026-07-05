# EdgeGuard AI Dashboard Implementation Plan

This plan details the steps to compile, verify, run, and test the premium industrial dashboard frontend for **EdgeGuard AI**, resolving mismatches between the DOM selectors in `app.js` and `dashboard.html` and validating the Flask integration.

## Proposed Changes

### [Frontend Components]

#### [MODIFY] [app.js](file:///c:/Users/U.SIDDIQ%20ALIKHAN/Desktop/Edge-guard%20AI/static/js/app.js)
- Run `write_appjs.py` to write the aligned v2.1 frontend controller script matching DOM selectors to `templates/dashboard.html`.
- Manually refine any residual DOM selector issues identified during testing.

#### [VERIFY] [check_ids.py](file:///c:/Users/U.SIDDIQ%20ALIKHAN/Desktop/Edge-guard%20AI/check_ids.py)
- Execute `python check_ids.py` to confirm that all DOM element references (`getElementById`, query class queries) in JavaScript find their exact matching element targets in the HTML document.

### [Backend Execution]

#### [RUN] [backend.py](file:///c:/Users/U.SIDDIQ%20ALIKHAN/Desktop/Edge-guard%20AI/backend.py)
- Start the Flask backend on port `5000` to serve the REST API endpoints (`/latest`, `/history`, `/analytics`, etc.) and the HTML dashboard page.

## Verification Plan

### Automated Tests
- Run `python check_ids.py` to ensure complete alignment of ID and class selectors.
- Check standard console outputs in the browser for any JavaScript errors.

### Manual Verification
- Start the Flask server.
- Launch the browser subagent to interactively load the dashboard at `http://127.0.0.1:5000`.
- Verify the following features:
  - **Sidebar navigation**: Check that tabs (Dashboard, Live Monitoring, Incident History, Analytics, AI Incident Reports, Settings, About) transition smoothly with proper active indicators.
  - **Live status updates**: Check that workers count, machines count, dynamic risk levels, status badge colors (Safe, Warning, Critical), and FPS values render.
  - **Horizontal risk meter**: Validate smooth transitions and proper color categorization (Green/Yellow/Red).
  - **Interactive Charts**: Verify that Chart.js initializes, rendering the Risk Level Trend, Worker/Machine trends, and Status distribution donut chart.
  - **Database History**: Check pagination, search filters, and compiled reports.
  - **AI Incident Reports**: Verify selecting a warning or critical incident compiled a professional safety summary, actions, and safety recommendations, with download/print links fully styled.
  - **Settings panel**: Verify changing backend URL, polling interval range slider, and simulation sliders updates the dynamic state.
