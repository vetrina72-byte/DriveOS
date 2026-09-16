import re

with open("components/MapsContainer.tsx", "r") as f:
    content = f.read()

# I need to add the catch block
bad_block = """      applyRoute(data.routes, 0);

    } else {
      devCntRef.current = 0;
    }
  }, [updateHUD]); // Will manually adjust dependencies later if needed"""

good_block = """      applyRoute(data.routes, 0);
    } catch (err) {
      console.warn('Routing error', err);
    }
  }, [updateHUD]);
"""

content = content.replace(bad_block, good_block)

with open("components/MapsContainer.tsx", "w") as f:
    f.write(content)
