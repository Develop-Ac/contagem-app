'use client';

/**
 * @file components/AppHeader.tsx
 * @description
 * Cabeçalho fixo da aplicação, com o botão de sair.
 *
 * Não é exibido na tela de login: ali não há sessão para encerrar.
 */
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { sync } from '@/lib/sync';
import { MaterialIcon } from './MaterialIcon';

export function AppHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { clear } = useSession();
    const toast = useToast();

    if (pathname === '/login') return null;

    /**
     * Encerra a sessão do conferente.
     *
     * Os registros pendentes permanecem no dispositivo de propósito: eles são
     * enviados na próxima vez que houver conexão, independentemente de quem
     * estiver logado.
     */
    const logout = async () => {
        const pendentes = await sync.countPending();

        if (pendentes > 0) {
            const confirmar = window.confirm(
                `Há ${pendentes} contagem(ns) ainda não enviada(s) ao servidor. `
                + 'Elas continuarão salvas neste dispositivo. Deseja sair mesmo assim?',
            );
            if (!confirmar) return;
        }

        clear();
        router.replace('/login');
        toast.show('Sessão encerrada.');
    };

    return (
        <header className="app-header">
            <div className="app-header__row">
                <span className="app-header__title">
                    <Image
                        src="/assets/logo_icon.png"
                        alt=""
                        className="header-logo"
                        width={32}
                        height={32}
                        priority
                    />
                    Sistema de Contagem
                </span>
                <div className="header-actions">
                    <button
                        className="header-logout"
                        type="button"
                        title="Sair"
                        aria-label="Sair"
                        onClick={logout}
                    >
                        <MaterialIcon name="power_settings_new" />
                    </button>
                </div>
            </div>
        </header>
    );
}
