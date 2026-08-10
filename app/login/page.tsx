'use client';

/**
 * @file app/login/page.tsx
 * @description Tela de autenticação do conferente.
 */
import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { HttpError } from '@/lib/http';
import { createLogger } from '@/lib/logger';
import type { LoginResponse, Usuario } from '@/lib/types';

const log = createLogger('LoginView');

/**
 * Converte a resposta da API no formato de sessão da aplicação.
 */
function toUsuario(response: LoginResponse): Usuario {
    return {
        id: response.usuario_id,
        nome: response.usuario,
        codigo: response.codigo,
    };
}

export default function LoginPage() {
    const router = useRouter();
    const { setUsuario, clearContagem } = useSession();
    const toast = useToast();

    const [codigo, setCodigo] = useState('');
    const [senha, setSenha] = useState('');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const codigoLimpo = codigo.trim();
        const senhaLimpa = senha.trim();

        if (!codigoLimpo || !senhaLimpa) {
            toast.show('Preencha o código e a senha.');
            return;
        }

        setBusy(true);

        try {
            const response = await api.login(codigoLimpo, senhaLimpa);

            if (!response || !response.success) {
                toast.show(response?.message || 'Código ou senha inválidos.');
                return;
            }

            setUsuario(toUsuario(response));
            clearContagem();

            setCodigo('');
            setSenha('');
            toast.show('Login realizado com sucesso!');

            router.replace('/contagens');
        } catch (error) {
            log.error('Falha no login.', error);
            toast.error(
                error instanceof HttpError && error.status
                    ? error.message
                    : 'Não foi possível conectar ao servidor. Tente novamente.',
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="screen screen--login" aria-label="Acesso ao sistema">
            <div className="login-container">
                <div className="login-shell">
                    <div className="login-panel login-panel__brand">
                        <div className="brand-content">
                            <div className="login-logo">
                                <Image
                                    src="/assets/logo_completa.png"
                                    alt="AC Acessórios"
                                    width={1951}
                                    height={1063}
                                    priority
                                />
                            </div>
                            <h2>Bem-vindo ao Sistema de Contagem</h2>
                            <p className="brand-text">Acesse com suas credenciais.</p>
                        </div>
                    </div>

                    <div className="login-panel login-panel__form">
                        <div className="form-content">
                            <div className="login-logo login-logo--mobile">
                                <Image
                                    src="/assets/logo_completa.png"
                                    alt="AC Acessórios"
                                    width={1951}
                                    height={1063}
                                />
                            </div>

                            <h4>Vamos iniciar</h4>
                            <p className="form-subtitle">Entre com sua conta</p>

                            <form className="login-form" noValidate onSubmit={handleSubmit}>
                                <label className="sr-only" htmlFor="codigo">Código do usuário</label>
                                <input
                                    className="login-input"
                                    type="text"
                                    id="codigo"
                                    name="codigo"
                                    placeholder="Código do usuário"
                                    autoComplete="username"
                                    inputMode="numeric"
                                    enterKeyHint="next"
                                    required
                                    autoFocus
                                    value={codigo}
                                    onChange={(event) => setCodigo(event.target.value)}
                                />

                                <label className="sr-only" htmlFor="senha">Senha</label>
                                <input
                                    className="login-input"
                                    type="password"
                                    id="senha"
                                    name="senha"
                                    placeholder="Senha"
                                    autoComplete="current-password"
                                    enterKeyHint="go"
                                    required
                                    value={senha}
                                    onChange={(event) => setSenha(event.target.value)}
                                />

                                {busy && <Spinner className="login-spinner" />}

                                <button type="submit" className="login-button" disabled={busy}>
                                    Entrar
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
