import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MenuSection, MenuItem } from './menuData';

interface UseMenuStateProps {
  menuSections: MenuSection[];
  isMenuItemActive: (item: MenuItem) => boolean;
  searchQuery: string;
  pathname: string;
  search: string;
  username?: string;
}

export function useMenuState({
  menuSections,
  isMenuItemActive,
  searchQuery,
  pathname,
  search,
  username,
}: UseMenuStateProps) {
  // All useState hooks must be at the top
  const [openSections, setOpenSections] = useState<string[]>(['EXPLORE']);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);
  const [wasSearching, setWasSearching] = useState(false);

  // Filter menu sections based on search query
  const filteredMenuSections = useMemo(() => {
    if (!searchQuery.trim()) return menuSections;

    const query = searchQuery.toLowerCase();
    return menuSections
      .map(section => {
        const sectionMatches = section.title.toLowerCase().includes(query);
        const filteredItems = section.items.filter(item => {
          const itemMatches = item.label.toLowerCase().includes(query);
          const subItemMatches = item.subItems?.some(subItem =>
            subItem.label.toLowerCase().includes(query)
          );
          return itemMatches || subItemMatches;
        });

        if (sectionMatches || filteredItems.length > 0) {
          return {
            ...section,
            items: sectionMatches ? section.items : filteredItems,
          };
        }
        return null;
      })
      .filter((section): section is MenuSection => section !== null);
  }, [menuSections, searchQuery]);

  // Auto-expand section containing active menu item
  useEffect(() => {
    menuSections.forEach(section => {
      const hasActiveItem = section.items.some(item => {
        if (isMenuItemActive(item)) return true;
        if (item.subItems) {
          return item.subItems.some(subItem => isMenuItemActive(subItem));
        }
        return false;
      });

      if (hasActiveItem && !openSections.includes(section.title)) {
        setOpenSections(prev => [...prev, section.title]);
      }

      // Auto-expand sub-items containing active item
      section.items.forEach(item => {
        if (item.subItems) {
          const hasActiveSubItem = item.subItems.some(subItem => isMenuItemActive(subItem));
          if (hasActiveSubItem && !openSubItems.includes(item.label)) {
            setOpenSubItems(prev => [...prev, item.label]);
          }
        }
      });
    });
  }, [pathname, search, username, menuSections, isMenuItemActive, openSections, openSubItems]);

  // Auto-expand sections when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setWasSearching(true);
      const matchingSections = filteredMenuSections.map(s => s.title);
      setOpenSections(matchingSections);

      const matchingSubItems: string[] = [];
      menuSections.forEach(section => {
        section.items.forEach(item => {
          if (item.subItems?.some(sub =>
            sub.label.toLowerCase().includes(searchQuery.toLowerCase())
          )) {
            matchingSubItems.push(item.label);
          }
        });
      });
      setOpenSubItems(matchingSubItems);
    } else if (wasSearching) {
      // Only reset when search is actively cleared (not on initial mount)
      setWasSearching(false);
      setOpenSections(['EXPLORE']);
      setOpenSubItems([]);
    }
  }, [searchQuery, filteredMenuSections, menuSections, wasSearching]);

  const toggleSection = useCallback((title: string, isOpen: boolean, onToggle: () => void) => {
    if (!isOpen) {
      onToggle();
      setOpenSections([title]);
    } else {
      setOpenSections(prev =>
        prev.includes(title)
          ? prev.filter(s => s !== title)
          : [title]
      );
    }
  }, []);

  const toggleSubItem = useCallback((label: string) => {
    setOpenSubItems(prev =>
      prev.includes(label)
        ? prev.filter(s => s !== label)
        : [...prev, label]
    );
  }, []);

  return {
    openSections,
    openSubItems,
    filteredMenuSections,
    toggleSection,
    toggleSubItem,
  };
}
