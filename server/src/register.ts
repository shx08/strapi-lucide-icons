import type { Core } from '@strapi/strapi';
import * as pluginPkg from '../../package.json';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: 'icon',
    plugin: pluginPkg.strapi.name,
    type: 'string',
  });
};

export default register;
