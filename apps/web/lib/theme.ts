'use client';

import { createTheme, type PaletteMode } from '@mui/material/styles';

const getDesignTokens = (mode: PaletteMode) => ({
	palette: {
		mode,
		...(mode === 'light'
			? {
					primary: { main: '#0d47a1' },
					secondary: { main: '#1565c0' },
					background: { default: '#f8f9fa', paper: '#ffffff' },
					text: { primary: '#1a1a1a', secondary: '#5c5c5c', disabled: '#9ca3af' },
					success: { main: '#0d7d4a' },
					error: { main: '#b91c1c' },
					warning: { main: '#b45309' },
					info: { main: '#0369a1' },
					divider: 'rgba(0,0,0,0.08)',
				}
			: {
					primary: { main: '#90caf9' },
					secondary: { main: '#42a5f5' },
					background: { default: '#0d1117', paper: '#161b22' },
					text: { primary: '#e6edf3', secondary: '#8b949e', disabled: '#6e7681' },
					success: { main: '#3fb950' },
					error: { main: '#f85149' },
					warning: { main: '#d29922' },
					info: { main: '#58a6ff' },
					divider: 'rgba(255,255,255,0.08)',
				}),
	},
	shape: { borderRadius: 8 },
	typography: {
		fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
		h1: { fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 },
		h2: { fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 },
		h3: { fontWeight: 600, lineHeight: 1.3 },
		h4: { fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.01em', lineHeight: 1.35 },
		h5: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
		h6: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
		body1: { fontSize: '1rem', lineHeight: 1.55 },
		body2: { color: 'inherit', fontSize: '0.875rem', lineHeight: 1.5 },
		caption: { fontSize: '0.75rem', lineHeight: 1.45 },
		subtitle1: { fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4 },
		subtitle2: { fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.45 },
	},
	spacing: 8,
	breakpoints: {
		values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
	},
	components: {
		MuiButton: {
			styleOverrides: {
				root: {
					textTransform: 'none',
					fontWeight: 600,
					minHeight: 44,
					'@media (min-width: 600px)': { minHeight: 40 },
				},
			},
		},
		MuiIconButton: {
			styleOverrides: {
				root: {
					minWidth: 44,
					minHeight: 44,
				},
			},
		},
		MuiCard: {
			styleOverrides: {
				root: {
					boxShadow: mode === 'light' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
				},
			},
		},
		MuiCardContent: {
			styleOverrides: {
				root: {
					padding: 20,
					'&:last-child': { paddingBottom: 20 },
					'@media (min-width: 600px)': { padding: 24, '&:last-child': { paddingBottom: 24 } },
				},
			},
		},
		MuiCardHeader: {
			styleOverrides: {
				root: {
					padding: 20,
					paddingBottom: 0,
					'@media (min-width: 600px)': { padding: 24, paddingBottom: 0 },
				},
				title: { fontSize: '1rem', fontWeight: 600 },
				subheader: { fontSize: '0.8125rem', marginTop: 2 },
			},
		},
		MuiAlert: {
			styleOverrides: {
				root: { borderRadius: 1 },
				standardError: { border: '1px solid', borderColor: 'error.main' },
				standardInfo: { border: '1px solid', borderColor: 'info.main' },
			},
		},
		MuiChip: {
			styleOverrides: {
				root: { fontWeight: 500 },
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					boxShadow: mode === 'light' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
				},
			},
		},
		MuiFormControl: {
			styleOverrides: {
				root: {
					minWidth: 0,
				},
			},
		},
		MuiTableCell: {
			styleOverrides: {
				root: {
					padding: '10px 12px',
					fontSize: '0.8125rem',
					'@media (min-width: 600px)': { padding: '12px 16px', fontSize: '0.875rem' },
				},
				head: {
					fontWeight: 600,
					color: 'inherit',
					bgcolor: mode === 'light' ? 'grey.50' : 'grey.900',
				},
			},
		},
		MuiTableRow: {
			styleOverrides: {
				root: {
					'&:hover': { bgcolor: mode === 'light' ? 'action.hover' : 'action.selected' },
				},
			},
		},
		MuiTooltip: {
			defaultProps: { enterDelay: 400, leaveDelay: 0, placement: 'top' as const },
			styleOverrides: {
				tooltip: { fontSize: '0.8125rem', fontWeight: 500 },
			},
		},
		MuiSkeleton: {
			defaultProps: { animation: 'pulse' as const },
			styleOverrides: {
				root: { borderRadius: 1 },
			},
		},
		MuiTabs: {
			styleOverrides: {
				indicator: { height: 2 },
			},
		},
		MuiTab: {
			styleOverrides: {
				root: { textTransform: 'none', fontWeight: 500, minHeight: 44 },
			},
		},
	},
});

export function createMeridianTheme(mode: PaletteMode) {
	return createTheme(getDesignTokens(mode));
}
