import type { Core } from '@strapi/strapi';

const icons = ({ strapi }: { strapi: Core.Strapi }) => ({
  async list() {
    const { default: dynamicIconImports } = await import('lucide-react/dynamicIconImports');
    return Object.keys(dynamicIconImports as Record<string, unknown>);
  },

  normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  },
});

export default icons;
