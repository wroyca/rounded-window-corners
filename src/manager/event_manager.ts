/**
 * @file Manages connections between gnome shell events and the rounded corners
 * effect. See {@link enableEffect} for more information.
 */

import {connections} from '../utils/connections.js';
import {_log} from '../utils/log.js';
import {settings} from '../utils/settings.js';
import * as handlers from './event_handlers.js';

import type Gio from 'gi://Gio';
import type Meta from 'gi://Meta';
import type Shell from 'gi://Shell';
import type {SchemasKeys} from '../utils/settings.js';
import type {ExtensionsWindowActor} from '../utils/types.js';

const connectionManager = connections.get();

/**
 * The rounded corners effect has to perform some actions when differen events
 * happen. For example, when a new window is opened, the effect has to detect
 * it and add rounded corners to it.
 *
 * The `enableEffect` method handles this by attaching the necessary signals
 * to matching handlers on each effect.
 */
export function enableEffect() {
    // Update the effect when settings are changed.
    connectionManager.connect(
        settings().g_settings,
        'changed',
        (_: Gio.Settings, key: string) =>
            handlers.onSettingsChanged(key as SchemasKeys),
    );

    const wm = global.windowManager;

    // Add the effect to all windows when the extension is enabled.
    const windowActors = global.get_window_actors();
    _log(`Initial window count: ${windowActors.length}`);
    for (const actor of windowActors) {
        applyEffectTo(actor);
    }

    // Add the effect to new windows when they are opened.
    connectionManager.connect(
        global.display,
        'window-created',
        (_: Meta.Display, win: Meta.Window) => {
            const actor: Meta.WindowActor = win.get_compositor_private();

            // If wm_class_instance of Meta.Window is null, wait for it to be
            // set before applying the effect.
            if (win?.get_wm_class_instance() == null) {
                const notifyId = win.connect('notify::wm-class', () => {
                    applyEffectTo(actor);
                    win.disconnect(notifyId);
                });
            } else {
                applyEffectTo(actor);
            }
        },
    );

    // Window minimized.
    connectionManager.connect(
        wm,
        'minimize',
        (_: Shell.WM, actor: Meta.WindowActor) => handlers.onMinimize(actor),
    );

    // Window unminimized.
    connectionManager.connect(
        wm,
        'unminimize',
        (_: Shell.WM, actor: Meta.WindowActor) => handlers.onUnminimize(actor),
    );

    // When closing the window, remove the effect from it.
    connectionManager.connect(
        wm,
        'destroy',
        (_: Shell.WM, actor: Meta.WindowActor) => removeEffectFrom(actor),
    );

    // When windows are restacked, the order of shadow actors as well.
    connectionManager.connect(
        global.display,
        'restacked',
        handlers.onRestacked,
    );
}

/** Disable the effect for all windows. */
export function disableEffect() {
    for (const actor of global.get_window_actors()) {
        removeEffectFrom(actor);
    }

    connectionManager?.disconnect_all();
}

/**
 * Apply the effect to a window.
 *
 * While {@link enableEffect} handles global events such as window creation,
 * this function handles events that happen to a specific window, like changing
 * its size or workspace.
 *
 * @param actor - The window actor to apply the effect to.
 */
function applyEffectTo(actor: ExtensionsWindowActor) {
    // In wayland sessions, the surface actor of XWayland clients is sometimes
    // not ready when the window is created. In this case, we wait until it is
    // ready before applying the effect.
    if (!actor.firstChild) {
        const id = actor.connect('notify::first-child', () => {
            applyEffectTo(actor);
            actor.disconnect(id);
        });

        return;
    }

    const texture = actor.get_texture();
    if (!texture) {
        return;
    }

    // Window resized.
    //
    // The signal has to be connected both to the actor and the texture. Why is
    // that? I have no idea. But without that, weird bugs can happen. For
    // example, when using Dash to Dock, all opened windows will be invisible
    // *unless they are pinned in the dock*. So yeah, GNOME is magic.
    connectionManager.connect(actor, 'notify::size', () =>
        handlers.onSizeChanged(actor),
    );
    connectionManager.connect(texture, 'size-changed', () => {
        handlers.onSizeChanged(actor);
    });

    // Window focus changed.
    connectionManager.connect(actor.metaWindow, 'notify::appears-focused', () =>
        handlers.onFocusChanged(actor),
    );

    // Workspace or monitor of the window changed.
    connectionManager.connect(actor.metaWindow, 'workspace-changed', () => {
        handlers.onFocusChanged(actor);
    });

    handlers.onAddEffect(actor);
}

/**
 * Remove the effect from a window.
 *
 * @param actor - The window actor to remove the effect from.
 */
function removeEffectFrom(actor: ExtensionsWindowActor) {
    if (connectionManager) {
        connectionManager.disconnect_all(actor);
        connectionManager.disconnect_all(actor.metaWindow);
    }

    handlers.onRemoveEffect(actor);
}
