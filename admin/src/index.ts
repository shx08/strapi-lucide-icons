import pluginPkg from '../../package.json';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { PLUGIN_ID } from './pluginId';
import { getTranslation } from './utils/getTranslation';

export default {
  register(app: any) {
    app.customFields.register({
      name: 'icon',
      pluginId: PLUGIN_ID,
      type: 'string',
      icon: PluginIcon,
      intlLabel: {
        id: getTranslation('input.label'),
        defaultMessage: pluginPkg.strapi.displayName,
      },
      intlDescription: {
        id: getTranslation('input.description'),
        defaultMessage: 'Pick a Lucide icon',
      },
      components: {
        Input: async () => import('./components/LucideIconInput'),
      },
      options: {
        advanced: [
          {
            sectionTitle: {
              id: 'global.settings',
              defaultMessage: 'Settings',
            },
            items: [
              {
                name: 'required',
                type: 'checkbox',
                intlLabel: {
                  id: getTranslation('form.attribute.item.requiredField'),
                  defaultMessage: 'Required field',
                },
                description: {
                  id: getTranslation('form.attribute.item.requiredField.description'),
                  defaultMessage: "You won't be able to create an entry if this field is empty",
                },
              },
              {
                name: 'private',
                type: 'checkbox',
                intlLabel: {
                  id: getTranslation('form.attribute.item.privateField'),
                  defaultMessage: 'Private field',
                },
                description: {
                  id: getTranslation('form.attribute.item.privateField.description'),
                  defaultMessage: 'This field will not show up in the API response',
                },
              },
            ],
          },
        ],
      },
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: pluginPkg.strapi.displayName,
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
