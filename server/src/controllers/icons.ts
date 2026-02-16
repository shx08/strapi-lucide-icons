import type { Core } from '@strapi/strapi';
import { PLUGIN_ID } from '../pluginId';

const icons = ({ strapi }: { strapi: Core.Strapi }) => ({
  async list(ctx) {
    const iconNames = await strapi.plugin(PLUGIN_ID).service('icons').list();
    ctx.body = { icons: iconNames };
  },
});

export default icons;
