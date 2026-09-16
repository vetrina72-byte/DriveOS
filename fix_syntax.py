import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

bad_block = """      applyRoute(data.routes, 0);
    } catch (err) {
      console.warn('Routing error', err);
    }
  }, [updateHUD]);

    } else {
      devCntRef.current = 0;
    }
  }, [updateHUD]); // Will manually adjust dependencies later if needed"""

good_block = """      applyRoute(data.routes, 0);
    } catch (err) {
      console.warn('Routing error', err);
    }
  }, [updateHUD]);"""

content = content.replace(bad_block, good_block)

# Let me check if there's another occurrence
bad_block_2 = """      applyRoute(data.routes, 0);
    } catch (err) {
      console.warn('Routing error', err);
    }
  }, [updateHUD]); // Will manually adjust dependencies later if needed"""

if bad_block in content:
    content = content.replace(bad_block, good_block)
else:
    # Just remove the spurious block
    content = re.sub(r'\} catch \(err\) \{\n      console\.warn\(\'Routing error\', err\);\n    \}\n  \}, \[updateHUD\]\);\n\n    \} else \{\n      devCntRef\.current = 0;\n    \}\n  \}, \[updateHUD\]\); // Will manually adjust dependencies later if needed', good_block, content)

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
