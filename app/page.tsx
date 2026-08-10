'use client';

/**
 * @file app/page.tsx
 * @description
 * Rota inicial: decide para onde mandar o conferente a partir da sessão salva.
 *
 *   sem sessão                → /login
 *   sessão + contagem aberta  → /itens  (retoma de onde parou)
 *   sessão                    → /contagens
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { useSession } from '@/hooks/useSession';
import { createLogger } from '@/lib/logger';

const log = createLogger('Main');

export default function Home() {
    const router = useRouter();
    const { restored, isAutenticado, contagem } = useSession();

    useEffect(() => {
        if (!restored) return;

        if (!isAutenticado) {
            router.replace('/login');
            return;
        }

        if (contagem) {
            log.info(`Retomando a contagem #${contagem.contagem}.`);
            router.replace('/itens');
            return;
        }

        router.replace('/contagens');
    }, [restored, isAutenticado, contagem, router]);

    return (
        <section className="screen" aria-label="Carregando o aplicativo">
            <Spinner centered />
        </section>
    );
}
