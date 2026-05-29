---
type: project
created: 2026-05-29
updated: 2026-05-29
---

# Project Conventions

## Database Conventions
- All system, maintenance, and configuration tables must use the prefix `sys_`.
  - Config Table: `sys_config`
  - Backup Log Table: `sys_backup_log`

## Schema Requirements for `sys_config`
The `sys_config` table must store the following properties:
- **Server Connection**: Host address (`db_server_host`) and port used (`db_server_port`).
- **Database Connection**: Database name (`db_name`) and port used (`db_port`).
- **Backup Path**: The location of the backup folder (`backup_folder_path`). In the UI, this should offer a way to pick/select folders.
- **Backup Automation**: Periodicity setting (`backup_periodicity`) to configure the schedule (e.g., Daily, Weekly, Monthly, Disabled).
