"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useThemeMode } from "./providers/ThemeProvider";

const LOGO_URL = "/assets/logos/meridian-logo1.png";

const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/terminal", label: "Terminal" },
  { href: "/research", label: "Research" },
  { href: "/simulation", label: "Simulation" },
  { href: "/about", label: "About" },
];

const DRAWER_WIDTH = 280;

export function TopNav() {
  const pathname = usePathname();
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  const navContent = (
    <>
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Button
            key={link.href}
            component={Link}
            href={link.href}
            size="medium"
            onClick={closeDrawer}
            sx={{
              minHeight: 44,
              color: active ? "primary.main" : "text.secondary",
              fontWeight: active ? 600 : 500,
              bgcolor: active ? "action.selected" : "transparent",
              "&:hover": { bgcolor: "action.hover" },
              justifyContent: { xs: "flex-start", md: "center" },
              px: { xs: 2, md: 1.5 },
            }}
          >
            {link.label}
          </Button>
        );
      })}
    </>
  );

  return (
    <>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar
          disableGutters
          sx={{
            px: { xs: 1.5, sm: 2, md: 3 },
            py: 0,
            minHeight: { xs: 56, sm: 64 },
            gap: 0.5,
          }}
        >
          {!isDesktop && (
            <IconButton
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              color="inherit"
              sx={{ minWidth: 44, minHeight: 44, mr: 0.5 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Link
            href="/"
            onClick={closeDrawer}
            style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            <Box
              component="img"
              src={LOGO_URL}
              alt="Meridian"
              sx={{
                height: { xs: 32, sm: 36 },
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Link>
          <Box sx={{ flexGrow: 1 }} />
          {isDesktop && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0 }}>
              {navContent}
            </Box>
          )}
          <Tooltip title={mode === "dark" ? "Use light mode" : "Use dark mode"}>
            <IconButton
              onClick={toggleMode}
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              color="inherit"
              sx={{ minWidth: 44, minHeight: 44, ml: 0.5 }}
            >
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            maxWidth: "85vw",
            boxSizing: "border-box",
            pt: 2,
            pb: 3,
            px: 1,
          },
        }}
      >
        <Box sx={{ px: 2, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            component="img"
            src={LOGO_URL}
            alt="Meridian"
            sx={{ height: 28, width: "auto", objectFit: "contain" }}
          />
          <Typography variant="subtitle2" color="text.secondary">
            Menu
          </Typography>
        </Box>
        <Divider sx={{ mb: 1 }} />
        <List disablePadding>
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <ListItemButton
                key={link.href}
                component={Link}
                href={link.href}
                onClick={closeDrawer}
                selected={active}
                sx={{
                  minHeight: 48,
                  borderRadius: 1,
                  mb: 0.5,
                  "&.Mui-selected": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText primary={link.label} primaryTypographyProps={{ fontWeight: active ? 600 : 500 }} />
              </ListItemButton>
            );
          })}
        </List>
        <Divider sx={{ my: 2 }} />
        <ListItemButton
          onClick={() => {
            toggleMode();
            closeDrawer();
          }}
          sx={{ minHeight: 48, borderRadius: 1 }}
        >
          {mode === "dark" ? <LightModeIcon sx={{ mr: 1.5 }} /> : <DarkModeIcon sx={{ mr: 1.5 }} />}
          <ListItemText primary={mode === "dark" ? "Light mode" : "Dark mode"} />
        </ListItemButton>
      </Drawer>
    </>
  );
}
