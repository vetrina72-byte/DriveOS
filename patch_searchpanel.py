import re

with open("components/SearchPanel.tsx", "r") as f:
    content = f.read()

# Add logic for clicking outside to close
# We'll use a standard useEffect with mousedown on document.
react_import = "import React, { useState, useEffect, useRef } from 'react';"
content = content.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef, useCallback } from 'react';")

hook_addition = """
  // Close search panel on outside click
  const searchContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);
"""

content = content.replace("  const inputRef = useRef<HTMLInputElement>(null);\n", "  const inputRef = useRef<HTMLInputElement>(null);\n" + hook_addition)
content = content.replace('<div className={`w-full backdrop-blur-md', '<div ref={searchContainerRef} className={`w-full backdrop-blur-md')

with open("components/SearchPanel.tsx", "w") as f:
    f.write(content)
