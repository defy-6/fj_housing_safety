# Windows development guide

## Requirements

- Windows 10 or Windows 11, 64-bit
- Node.js 22 LTS or newer
- Python 3.11 or newer when rebuilding the database or platform data
- Git for Windows when continuing Git development

## First start

1. Extract the package to a normal development folder. Avoid running directly inside the ZIP archive.
2. Double-click `start-platform.bat`.
3. The launcher checks Node.js, installs frontend dependencies on first use, selects an available port starting from 3100, and opens the platform in the default browser.
4. Runtime logs and the selected URL are written under `runtime/`.

All project paths are resolved relative to the project root. The folder can be moved without editing configuration files.

## Command-line development

Open PowerShell in the project root:

```powershell
cd apps\web
npm install
npm run dev
```

Build verification:

```powershell
cd apps\web
npm run build
```

## Data development

Install Python dependencies:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Rebuild the SQLite database and browser data:

```powershell
python scripts\build_database.py
python scripts\build_platform_data.py
```

The package contains the current raw source files, GeoPackage, SQLite database and published frontend JSON so that development can continue offline. Do not publish raw source files or the local database to the public Git repository.

## Git workflow

The migration package does not contain `.git/`. To reconnect it to the existing repository:

```powershell
git init
git remote add origin https://github.com/defy-6/fj_housing_safety.git
git fetch origin
git reset origin/main
git branch -M main
git branch --set-upstream-to=origin/main main
```

The recommended alternative is to clone the repository first and then copy the locally retained `data/raw/` and `database/housing-safety.sqlite` into the clone.
