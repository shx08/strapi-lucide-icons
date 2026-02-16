declare module 'lucide-react/dynamicIconImports' {
  const dynamicIconImports: Record<string, () => Promise<{ default: any }>>;
  export default dynamicIconImports;
}
