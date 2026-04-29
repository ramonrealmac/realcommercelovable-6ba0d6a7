// Report Builder Pro — Entry Point
// Exporta o componente raiz e os tipos públicos
export { default as RpbManager } from './components/manager/RpbManager';
export { default as RpbExecutor } from './components/executor/RpbExecutor';
export { default as RpbDesigner } from './components/designer/RpbDesigner';
export { generateReportHtml } from './components/renderer/rpbRenderer';
export * from './types';
export * from './services/rpbService';
