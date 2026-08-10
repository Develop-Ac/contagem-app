/**
 * @file lib/session.ts
 * @description
 * Estado compartilhado entre as telas: usuário autenticado e contagem aberta.
 *
 * Tudo aqui é espelhado em `localStorage`, porque o app roda em coletores e
 * celulares onde a página é recarregada com frequência (bateria, troca de rede,
 * bloqueio de tela). Ao reabrir, o conferente volta exatamente onde estava.
 *
 * É um store de módulo — a mesma forma do `App.session` do aplicativo original.
 * Os componentes o observam por `useSession`, que usa `useSyncExternalStore`:
 * assim a leitura do `localStorage` acontece sem efeito de hidratação e sem
 * divergência entre o HTML pré-renderizado e o navegador.
 *
 * Nenhum módulo deve ler `localStorage` diretamente para esses dados.
 */
import { config } from './config';
import { storage } from './storage';
import type { Contagem, Usuario } from './types';

const KEYS = config.STORAGE_KEYS;

export interface SessionState {
    /** Usuário autenticado. */
    usuario: Usuario | null;
    /** Contagem atualmente aberta. */
    contagem: Contagem | null;
    /**
     * `false` enquanto o estado ainda não foi lido do `localStorage`.
     *
     * É o valor visto na renderização do servidor e na hidratação;
     * redirecionar antes disso mandaria o conferente para o login mesmo com
     * sessão válida.
     */
    restored: boolean;
}

/** Instantâneo devolvido antes de o `localStorage` estar disponível. */
const SERVER_SNAPSHOT: SessionState = { usuario: null, contagem: null, restored: false };

const listeners = new Set<() => void>();

let snapshot: SessionState = SERVER_SNAPSHOT;
let hidratado = false;

/**
 * Lê o estado gravado no dispositivo. Executa uma única vez, na primeira
 * leitura feita pelo navegador.
 */
function hidratar(): void {
    if (hidratado || typeof window === 'undefined') return;

    hidratado = true;
    snapshot = {
        usuario: storage.get<Usuario>(KEYS.USER, null),
        contagem: storage.get<Contagem>(KEYS.CONTAGEM, null),
        restored: true,
    };
}

/** Publica um novo instantâneo e avisa quem estiver observando. */
function publicar(patch: Partial<SessionState>): void {
    hidratar();
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
}

export const sessionStore = {
    /** Registra um observador. Devolve a função de baixa. */
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },

    /** Instantâneo atual (no navegador). */
    getSnapshot(): SessionState {
        hidratar();
        return snapshot;
    },

    /** Instantâneo usado na renderização do servidor e na hidratação. */
    getServerSnapshot(): SessionState {
        return SERVER_SNAPSHOT;
    },

    /** Define o usuário autenticado e persiste a sessão. */
    setUsuario(usuario: Usuario): void {
        storage.set(KEYS.USER, usuario);
        publicar({ usuario });
    },

    /** Define a contagem aberta e persiste para sobreviver a um recarregamento. */
    setContagem(contagem: Contagem): void {
        storage.set(KEYS.CONTAGEM, contagem);
        publicar({ contagem });
    },

    /** Fecha a contagem aberta (volta para a lista de tarefas). */
    clearContagem(): void {
        storage.remove(KEYS.CONTAGEM);
        if (sessionStore.getSnapshot().contagem === null) return;
        publicar({ contagem: null });
    },

    /** Encerra a sessão: limpa usuário e contagem, em memória e no disco. */
    clear(): void {
        storage.remove(KEYS.USER);
        storage.remove(KEYS.CONTAGEM);
        publicar({ usuario: null, contagem: null });
    },
};
