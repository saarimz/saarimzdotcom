(() => {
  const mobileInteractionQuery = window.matchMedia(
    "(max-width: 760px), ((hover: none) and (pointer: coarse))",
  );

  const nameBadge = document.querySelector(".name-badge");
  const placeMap = document.querySelector(".place-map");
  const placeFlag = placeMap?.querySelector(".place-flag");
  const mapPopover = placeMap?.querySelector(".map-popover");

  function isMobileInteraction() {
    return mobileInteractionQuery.matches;
  }

  function setNameActive(isActive) {
    if (!(nameBadge instanceof HTMLElement)) {
      return;
    }

    nameBadge.classList.toggle("is-active", isActive);
    nameBadge.setAttribute("aria-pressed", String(isActive));
  }

  function setMapOpen(isOpen) {
    if (!(placeMap instanceof HTMLElement)) {
      return;
    }

    placeMap.classList.toggle("is-open", isOpen);

    if (placeFlag instanceof HTMLElement) {
      placeFlag.setAttribute("aria-expanded", String(isOpen));
    }

    if (mapPopover instanceof HTMLElement) {
      mapPopover.setAttribute("aria-hidden", String(!isOpen));
    }
  }

  if (nameBadge instanceof HTMLElement) {
    nameBadge.setAttribute("role", "button");
    nameBadge.setAttribute("aria-pressed", "false");

    nameBadge.addEventListener("click", (event) => {
      if (!isMobileInteraction()) {
        return;
      }

      event.preventDefault();
      setNameActive(!nameBadge.classList.contains("is-active"));
    });
  }

  if (placeFlag instanceof HTMLAnchorElement) {
    placeFlag.setAttribute("aria-haspopup", "true");
    placeFlag.setAttribute("aria-expanded", "false");

    placeFlag.addEventListener("click", (event) => {
      if (!isMobileInteraction()) {
        return;
      }

      event.preventDefault();
      setMapOpen(true);
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!isMobileInteraction() || !(target instanceof Node)) {
      return;
    }

    if (placeMap instanceof HTMLElement && !placeMap.contains(target)) {
      setMapOpen(false);
    }

    if (nameBadge instanceof HTMLElement && !nameBadge.contains(target)) {
      setNameActive(false);
    }
  });

  mobileInteractionQuery.addEventListener("change", () => {
    if (!isMobileInteraction()) {
      setMapOpen(false);
      setNameActive(false);
    }
  });
})();
