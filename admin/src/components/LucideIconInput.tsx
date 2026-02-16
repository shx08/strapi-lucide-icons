import type { ChangeEvent, ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideProps } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { useIntl } from 'react-intl';
import {
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  IconButton,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { type InputProps, useField } from '@strapi/strapi/admin';
import styled from 'styled-components';
import { Cross } from '@strapi/icons';
import { getTranslation } from '../utils/getTranslation';
import { LUCIDE_CATEGORIES } from '../data/lucideCategories';

type StrapiChangeEvent = { target: { name: string; value: string; type?: string } };

type IconComponent = ComponentType<LucideProps>;

type DynamicIconImport = () => Promise<{ default: IconComponent }>;
const dynamicIconImportsTyped = dynamicIconImports as Record<string, DynamicIconImport>;

const DEFAULT_MAX_RESULTS = 2000;

const iconCache = new Map<string, IconComponent>();
const NullIcon: IconComponent = () => null;

const IconGrid = styled(Box)`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[2]};
  height: 100%;
  width: 100%;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  align-content: start;
  justify-content: start;
  gap: ${({ theme }) => theme.spaces[1]};
  background: ${({ theme }) => theme.colors.neutral0};
  flex: 1;
  min-height: 0;

  @media (max-width: 960px) {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
    padding: ${({ theme }) => theme.spaces[1]};
  }
`;

const IconTile = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.colors.primary600 : theme.colors.neutral200)};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: 0;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary100 : theme.colors.neutral0};
  text-align: center;
  color: ${({ theme }) => theme.colors.neutral700};
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
  position: relative;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &::before {
    content: '';
    display: block;
    padding-top: 100%;
  }
`;

const IconTileContent = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spaces[1]};
`;

const PreviewCard = styled(Box)`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[3]};
  background: ${({ theme }) => theme.colors.neutral0};
`;

const EmptyState = styled(Box)`
  border: 1px dashed ${({ theme }) => theme.colors.neutral300};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[4]};
  background: ${({ theme }) => theme.colors.neutral0};
`;

const CategoryList = styled(Box)`
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[2]};
  background: ${({ theme }) => theme.colors.neutral0};
  height: 60vh;
  max-height: 60vh;
  overflow: auto;
  min-width: 220px;

  @media (max-width: 960px) {
    min-width: 200px;
  }

  @media (max-width: 768px) {
    width: 100%;
    min-width: 0;
    height: auto;
    max-height: 30vh;
  }
`;

const WideDialogContent = styled(Dialog.Content)`
  width: fit-content;
  max-width: 98vw;
  max-height: 85vh;
  padding: ${({ theme }) => theme.spaces[4]};
  box-sizing: border-box;

  @media (max-width: 960px) {
    padding: ${({ theme }) => theme.spaces[3]};
  }

  @media (max-width: 768px) {
    width: 100vw;
    max-width: 100vw;
    max-height: 95vh;
    padding: ${({ theme }) => theme.spaces[3]};
  }
`;

const FullWidthTextInput = styled(TextInput)`
  width: 100%;
`;

const IconPane = styled(Flex)`
  flex: 1;
  height: 60vh;
  min-height: 0;
  width: 100%;

  @media (max-width: 768px) {
    height: 50vh;
  }
`;

const IconPaneWrapper = styled(Box)`
  flex: 1;
  min-width: 640px;
  width: 100%;

  @media (max-width: 960px) {
    min-width: 520px;
  }

  @media (max-width: 768px) {
    min-width: 0;
  }
`;

const DialogLayout = styled(Flex)`
  align-items: flex-start;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }
`;

const DialogHeaderRow = styled(Flex)`
  width: 100%;
  align-items: center;
  justify-content: space-between;
`;

const DialogHeaderText = styled(Dialog.Header)`
  flex: 1;
`;

const CategoryButton = styled.button<{ $active: boolean }>`
  width: 100%;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary600 : 'transparent')};
  border-radius: ${({ theme }) => theme.borderRadius};
  padding: ${({ theme }) => theme.spaces[2]};
  background: ${({ theme, $active }) => ($active ? theme.colors.primary100 : 'transparent')};
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary600};
    background: ${({ theme }) => theme.colors.primary100};
  }
`;

const loadIcon = async (iconName: string) => {
  if (iconCache.has(iconName)) {
    return iconCache.get(iconName) ?? null;
  }

  const importer = dynamicIconImportsTyped[iconName];
  if (!importer) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[strapi-lucide-icons] Missing icon import: ${iconName}`);
    }
    return null;
  }

  try {
    const module = await importer();
    const iconComponent = module.default ?? null;
    if (iconComponent) {
      iconCache.set(iconName, iconComponent);
    }
    return iconComponent;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[strapi-lucide-icons] Failed to load icon: ${iconName}`, error);
    }
    return null;
  }
};

type LucideIconFieldProps = InputProps & {
  onChange: (event: StrapiChangeEvent) => void;
  attribute?: {
    options?: {
      maxResults?: number;
    };
  };
};

const IconPreview = ({ iconName }: { iconName: string }) => {
  const [Icon, setIcon] = useState<IconComponent | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const iconComponent = await loadIcon(iconName);
      if (isMounted) {
        setIcon(() => iconComponent);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [iconName]);

  if (!Icon) {
    return (
      <Box
        width={6}
        height={6}
        hasRadius
        borderColor="neutral300"
        borderStyle="dashed"
        borderWidth="1px"
        aria-hidden
      />
    );
  }

  return <Icon size={14} />;
};

const LucideIconInput = ({
  hint,
  disabled,
  labelAction,
  label,
  name,
  required,
  ...props
}: LucideIconFieldProps) => {
  const field = useField(name);
  const { formatMessage } = useIntl();
  const value = typeof field.value === 'string' ? field.value : '';
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [SelectedIcon, setSelectedIcon] = useState<IconComponent>(() => NullIcon);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const allIcons = useMemo(() => {
    return Object.keys(dynamicIconImportsTyped).sort();
  }, []);

  const maxResults =
    typeof props.attribute?.options?.maxResults === 'number'
      ? props.attribute.options.maxResults
      : DEFAULT_MAX_RESULTS;

  useEffect(() => {
    let isMounted = true;

    const setIcon = async () => {
      if (!value) {
        setSelectedIcon(() => NullIcon);
        return;
      }

      const iconComponent = await loadIcon(value);
      if (isMounted) {
        setSelectedIcon(() => iconComponent ?? NullIcon);
      }
    };

    void setIcon();

    return () => {
      isMounted = false;
    };
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = setTimeout(() => {
      searchRef.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const activeCategoryData = useMemo(() => {
    return (
      LUCIDE_CATEGORIES.find((category) => category.name === activeCategory) ?? LUCIDE_CATEGORIES[0]
    );
  }, [activeCategory]);

  const activeIcons = useMemo(() => {
    if (activeCategory === 'all') {
      return allIcons;
    }

    return activeCategoryData?.icons ?? [];
  }, [activeCategory, activeCategoryData, allIcons]);

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();
    const baseIcons = activeIcons;

    if (!query) {
      return baseIcons.slice(0, maxResults);
    }

    const results = baseIcons.filter((iconName) => iconName.includes(query));
    return results.slice(0, maxResults);
  }, [activeIcons, maxResults, search]);

  const handleSelect = (iconName: string) => {
    const event: StrapiChangeEvent = {
      target: {
        name,
        value: iconName,
        type: 'string',
      },
    };

    field.onChange(iconName);
    props.onChange(event);
    setIsOpen(false);
  };

  const handleClear = () => {
    const event: StrapiChangeEvent = {
      target: {
        name,
        value: '',
        type: 'string',
      },
    };

    field.onChange('');
    props.onChange(event);
  };

  return (
    <Field.Root
      name={name}
      id={name}
      hint={hint}
      required={required}
      disabled={disabled}
      error={field.error}
    >
      <Flex direction="column" alignItems="stretch" gap={2}>
        <Field.Label action={labelAction}>{label}</Field.Label>
        <PreviewCard>
          <Flex direction="row" alignItems="center" gap={3} justifyContent="space-between">
            <Flex direction="row" alignItems="center" gap={3}>
              <Flex
                background="neutral100"
                width={8}
                height={8}
                hasRadius
                alignItems="center"
                justifyContent="center"
                aria-hidden
              >
                <SelectedIcon size={20} />
              </Flex>
              <Typography variant="pi" fontWeight="bold" textColor="neutral700">
                {value || formatMessage({ id: getTranslation('input.none') })}
              </Typography>
            </Flex>
            <Flex gap={2}>
              {value ? (
                <Button variant="tertiary" onClick={handleClear} disabled={disabled}>
                  {formatMessage({ id: getTranslation('input.clear') })}
                </Button>
              ) : null}
              <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
                <Dialog.Trigger>
                  <Button variant="secondary" disabled={disabled}>
                    {formatMessage({ id: getTranslation('input.browse') })}
                  </Button>
                </Dialog.Trigger>
                <WideDialogContent>
                  <DialogHeaderRow>
                    <DialogHeaderText>
                      {formatMessage({ id: getTranslation('input.browse') })}
                    </DialogHeaderText>
                    <IconButton
                      label={formatMessage({ id: getTranslation('input.close') })}
                      variant="tertiary"
                      withTooltip={false}
                      onClick={() => setIsOpen(false)}
                    >
                      <Cross />
                    </IconButton>
                  </DialogHeaderRow>
                  <Dialog.Body>
                    <DialogLayout gap={4}>
                      <CategoryList>
                        <Flex direction="column" gap={1}>
                          {LUCIDE_CATEGORIES.map((category) => (
                            <CategoryButton
                              key={category.name}
                              type="button"
                              $active={category.name === activeCategory}
                              onClick={() => setActiveCategory(category.name)}
                            >
                              <Flex
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                gap={2}
                              >
                                <Typography variant="pi" fontWeight="bold" textColor="neutral600">
                                  {category.title}
                                </Typography>
                                <Typography variant="pi" textColor="neutral500">
                                  {category.name === 'all' ? allIcons.length : category.icons.length}
                                </Typography>
                              </Flex>
                            </CategoryButton>
                          ))}
                        </Flex>
                      </CategoryList>
                      <IconPaneWrapper>
                        <IconPane direction="column" gap={3}>
                          <FullWidthTextInput
                            aria-label={formatMessage({ id: getTranslation('input.search') })}
                            placeholder={formatMessage({
                              id: getTranslation('input.search_placeholder'),
                            })}
                            value={search}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => {
                              setSearch(event.target.value);
                            }}
                            ref={searchRef}
                          />
                          <Flex direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="pi" textColor="neutral600">
                              {formatMessage(
                                { id: getTranslation('input.showing') },
                                {
                                  count: filteredIcons.length,
                                  total:
                                    activeCategory === 'all'
                                      ? allIcons.length
                                      : activeCategoryData?.icons.length ?? 0,
                                }
                              )}
                            </Typography>
                            <Typography variant="pi" textColor="neutral600">
                              {activeCategory === 'all' ? 'All icons' : activeCategoryData?.title}
                            </Typography>
                          </Flex>
                          {filteredIcons.length === 0 ? (
                            <EmptyState>
                              <Typography variant="pi">
                                {formatMessage({ id: getTranslation('input.empty') })}
                              </Typography>
                            </EmptyState>
                          ) : (
                            <IconGrid>
                              {filteredIcons.map((iconName) => (
                                <IconTile
                                  key={iconName}
                                  type="button"
                                  $active={iconName === value}
                                  disabled={disabled}
                                  aria-pressed={iconName === value}
                                  aria-label={iconName}
                                  title={iconName}
                                  onClick={() => handleSelect(iconName)}
                                >
                                  <IconTileContent>
                                    <IconPreview iconName={iconName} />
                                  </IconTileContent>
                                </IconTile>
                              ))}
                            </IconGrid>
                          )}
                        </IconPane>
                      </IconPaneWrapper>
                    </DialogLayout>
                  </Dialog.Body>
                </WideDialogContent>
              </Dialog.Root>
            </Flex>
          </Flex>
        </PreviewCard>
        <Field.Hint />
        <Field.Error />
      </Flex>
    </Field.Root>
  );
};

export default LucideIconInput;
