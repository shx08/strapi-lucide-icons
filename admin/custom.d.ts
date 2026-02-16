declare module '@strapi/design-system/*';
declare module '@strapi/design-system';
declare module 'lucide-react/dynamicIconImports' {
  const dynamicIconImports: Record<string, () => Promise<{ default: any }>>;
  export default dynamicIconImports;
}
