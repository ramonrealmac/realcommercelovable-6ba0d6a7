# Plan - Subgrupos de Produtos Integration

## Overview
Add the new menu item "Subgrupos de Produtos" in the registration menu (after "Grupos de Produtos") and implement a fully functional screen to perform CRUD operations on product subgroups (`produto_subgrupo`), following the existing application standard.

## Project Type
WEB (React + Vite + Supabase + Tailwind CSS)

## Success Criteria
1. A new menu item "Subgrupos de Produtos" appears in the sidebar submenu under "Produtos" (after "Grupos de Produtos").
2. Clicking this menu item opens a new functional CRUD tab using `StandardCrudForm`.
3. In the subgroups form, users must be able to select the parent "Grupo de Produtos" (`produto_grupo_id`) using a lookup selection dropdown, edit the subgroup name, and see the parent group name in the search grid.

## Tech Stack
- Frontend: React (v18), TypeScript, Tailwind CSS, Lucide icons, Radix UI (Select)
- Backend/Database: Supabase (PostgreSQL client)

## File Structure
- `src/config/menuConfig.ts` (Modify)
- `src/pages/Index.tsx` (Modify)
- `src/components/forms/produtos/SubgrupoProdutosForm.tsx` (New)

## Task Breakdown

### Task 1: Add Menu Item
- **Agent**: `frontend-specialist`
- **Skills**: `clean-code`
- **Priority**: High
- **Dependencies**: None
- **INPUT**: `src/config/menuConfig.ts`
- **OUTPUT**: Modified `src/config/menuConfig.ts` with "Subgrupos de Produtos" item inserted under the "Produtos" category.
- **VERIFY**: Check that the item `{ id: "subgrupo-produtos", title: "Subgrupos de Produtos", icon: Boxes }` is correctly added after `{ id: "grupo-produtos", ... }`.

### Task 2: Implement CRUD Form
- **Agent**: `frontend-specialist`
- **Skills**: `clean-code`, `frontend-design`
- **Priority**: High
- **Dependencies**: Task 1
- **INPUT**: `src/components/forms/produtos/GrupoProdutosForm.tsx` and `src/components/forms/enderecos/CidadeForm.tsx` for reference.
- **OUTPUT**: `src/components/forms/produtos/SubgrupoProdutosForm.tsx`
- **VERIFY**: Check that `SubgrupoProdutosForm` correctly loads groups using `supabase.from("produto_grupo").select(...)` and displays them in a `<Select>` element when editing, and displays the virtual `grupo_nome` when in view mode. Check that fields are validated before save (name and group_id are required).

### Task 3: Map Router/Tab
- **Agent**: `frontend-specialist`
- **Skills**: `clean-code`
- **Priority**: High
- **Dependencies**: Task 2
- **INPUT**: `src/pages/Index.tsx`
- **OUTPUT**: Modified `src/pages/Index.tsx` to lazy load `SubgrupoProdutosForm` and map `case "subgrupo-produtos"` in `renderTabContent`.
- **VERIFY**: Check that compilation finishes without errors and navigating to the route renders the subgroup form tab.

## Phase X: Final Verification

### 1. Run Verification
- Execute `npm run lint` and `npx tsc --noEmit` to ensure zero typescript/linting issues.

### 2. Runtime Verification
- Start the development server using `npm run dev` (already running).
- Manually open the system, check the sidebar menu, click the new item, add a subgroup, select a group, save it, verify that it appears in the grid, edit it, and delete it.

### 3. Rule Compliance
- [x] No purple/violet hex codes
- [x] No standard template layouts (uses the standard project CRUD forms)
- [x] Socratic Gate was respected (asked questions/created plan before writing code)

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues (manual audit completed)
- Build: ✅ Success (TypeScript check completed with 0 errors)
- Date: 2026-05-28
