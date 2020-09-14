
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/App.svelte generated by Svelte v3.23.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	child_ctx[34] = list;
    	child_ctx[35] = i;
    	return child_ctx;
    }

    // (230:4) {:else}
    function create_else_block(ctx) {
    	let input_1;
    	let mounted;
    	let dispose;

    	function input_1_input_handler() {
    		/*input_1_input_handler*/ ctx[14].call(input_1, /*each_value*/ ctx[34], /*todo_index*/ ctx[35]);
    	}

    	function blur_handler(...args) {
    		return /*blur_handler*/ ctx[15](/*todo*/ ctx[33], ...args);
    	}

    	function keydown_handler(...args) {
    		return /*keydown_handler*/ ctx[16](/*todo*/ ctx[33], ...args);
    	}

    	const block = {
    		c: function create() {
    			input_1 = element("input");
    			attr_dev(input_1, "class", "todo-item-edit svelte-sa3mpf");
    			attr_dev(input_1, "type", "text");
    			input_1.autofocus = true;
    			add_location(input_1, file, 230, 5, 4806);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input_1, anchor);
    			set_input_value(input_1, /*todo*/ ctx[33].title);
    			input_1.focus();

    			if (!mounted) {
    				dispose = [
    					listen_dev(input_1, "input", input_1_input_handler),
    					listen_dev(input_1, "blur", blur_handler, false, false, false),
    					listen_dev(input_1, "keydown", keydown_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*filteredTodos*/ 8 && input_1.value !== /*todo*/ ctx[33].title) {
    				set_input_value(input_1, /*todo*/ ctx[33].title);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input_1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(230:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (228:4) {#if !todo.editing}
    function create_if_block(ctx) {
    	let div;
    	let t_value = /*todo*/ ctx[33].title + "";
    	let t;
    	let mounted;
    	let dispose;

    	function dblclick_handler(...args) {
    		return /*dblclick_handler*/ ctx[13](/*todo*/ ctx[33], ...args);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "todo-item-label svelte-sa3mpf");
    			toggle_class(div, "completed", /*todo*/ ctx[33].completed);
    			add_location(div, file, 228, 5, 4673);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = listen_dev(div, "dblclick", dblclick_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*filteredTodos*/ 8 && t_value !== (t_value = /*todo*/ ctx[33].title + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*filteredTodos*/ 8) {
    				toggle_class(div, "completed", /*todo*/ ctx[33].completed);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(228:4) {#if !todo.editing}",
    		ctx
    	});

    	return block;
    }

    // (224:2) {#each filteredTodos as todo}
    function create_each_block(ctx) {
    	let div2;
    	let div0;
    	let input_1;
    	let t0;
    	let div0_transition;
    	let t1;
    	let div1;
    	let current;
    	let mounted;
    	let dispose;

    	function input_1_change_handler() {
    		/*input_1_change_handler*/ ctx[12].call(input_1, /*each_value*/ ctx[34], /*todo_index*/ ctx[35]);
    	}

    	function select_block_type(ctx, dirty) {
    		if (!/*todo*/ ctx[33].editing) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[17](/*todo*/ ctx[33], ...args);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			input_1 = element("input");
    			t0 = space();
    			if_block.c();
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "×";
    			attr_dev(input_1, "type", "checkbox");
    			add_location(input_1, file, 226, 4, 4590);
    			attr_dev(div0, "class", "todo-item-left svelte-sa3mpf");
    			add_location(div0, file, 225, 3, 4513);
    			attr_dev(div1, "class", "remove-item svelte-sa3mpf");
    			add_location(div1, file, 233, 3, 4985);
    			attr_dev(div2, "class", "todo-item svelte-sa3mpf");
    			add_location(div2, file, 224, 2, 4486);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, input_1);
    			input_1.checked = /*todo*/ ctx[33].completed;
    			append_dev(div0, t0);
    			if_block.m(div0, null);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input_1, "change", input_1_change_handler),
    					listen_dev(div1, "click", click_handler, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*filteredTodos*/ 8) {
    				input_1.checked = /*todo*/ ctx[33].completed;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fly, { y: 20, duration: 300 }, true);
    				div0_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div0_transition) div0_transition = create_bidirectional_transition(div0, fly, { y: 20, duration: 300 }, false);
    			div0_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block.d();
    			if (detaching && div0_transition) div0_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(224:2) {#each filteredTodos as todo}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div6;
    	let img;
    	let img_src_value;
    	let t0;
    	let input0;
    	let t1;
    	let t2;
    	let div2;
    	let div0;
    	let label;
    	let input1;
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let t6;
    	let t7;
    	let div5;
    	let div3;
    	let button0;
    	let t9;
    	let button1;
    	let t11;
    	let button2;
    	let t13;
    	let div4;
    	let button3;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*filteredTodos*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			img = element("img");
    			t0 = space();
    			input0 = element("input");
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			div2 = element("div");
    			div0 = element("div");
    			label = element("label");
    			input1 = element("input");
    			t3 = text("Check All");
    			t4 = space();
    			div1 = element("div");
    			t5 = text(/*todosRemaining*/ ctx[2]);
    			t6 = text(" items left");
    			t7 = space();
    			div5 = element("div");
    			div3 = element("div");
    			button0 = element("button");
    			button0.textContent = "All";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Active";
    			t11 = space();
    			button2 = element("button");
    			button2.textContent = "Completed";
    			t13 = space();
    			div4 = element("div");
    			button3 = element("button");
    			button3.textContent = "Clear Completed";
    			if (img.src !== (img_src_value = "/img/favicon.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "svelte logo");
    			attr_dev(img, "class", "logo svelte-sa3mpf");
    			add_location(img, file, 219, 2, 4269);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "class", "todo-input svelte-sa3mpf");
    			attr_dev(input0, "placeholder", "What needs to be done");
    			add_location(input0, file, 221, 2, 4334);
    			attr_dev(input1, "type", "checkbox");
    			attr_dev(input1, "class", "svelte-sa3mpf");
    			add_location(input1, file, 242, 16, 5139);
    			add_location(label, file, 242, 9, 5132);
    			add_location(div0, file, 242, 4, 5127);
    			add_location(div1, file, 243, 4, 5216);
    			attr_dev(div2, "class", "extra-container svelte-sa3mpf");
    			add_location(div2, file, 241, 2, 5093);
    			attr_dev(button0, "class", "svelte-sa3mpf");
    			toggle_class(button0, "active", /*currentFilter*/ ctx[0] === "all");
    			add_location(button0, file, 248, 6, 5313);
    			attr_dev(button1, "class", "svelte-sa3mpf");
    			toggle_class(button1, "active", /*currentFilter*/ ctx[0] === "active");
    			add_location(button1, file, 249, 6, 5418);
    			attr_dev(button2, "class", "svelte-sa3mpf");
    			toggle_class(button2, "active", /*currentFilter*/ ctx[0] === "completed");
    			add_location(button2, file, 250, 6, 5532);
    			add_location(div3, file, 247, 4, 5301);
    			attr_dev(button3, "class", "svelte-sa3mpf");
    			add_location(button3, file, 254, 6, 5677);
    			add_location(div4, file, 253, 4, 5665);
    			attr_dev(div5, "class", "extra-container svelte-sa3mpf");
    			add_location(div5, file, 246, 2, 5267);
    			attr_dev(div6, "class", "container svelte-sa3mpf");
    			add_location(div6, file, 218, 0, 4243);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, img);
    			append_dev(div6, t0);
    			append_dev(div6, input0);
    			set_input_value(input0, /*newTodo*/ ctx[1]);
    			append_dev(div6, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			append_dev(div6, t2);
    			append_dev(div6, div2);
    			append_dev(div2, div0);
    			append_dev(div0, label);
    			append_dev(label, input1);
    			append_dev(label, t3);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, t5);
    			append_dev(div1, t6);
    			append_dev(div6, t7);
    			append_dev(div6, div5);
    			append_dev(div5, div3);
    			append_dev(div3, button0);
    			append_dev(div3, t9);
    			append_dev(div3, button1);
    			append_dev(div3, t11);
    			append_dev(div3, button2);
    			append_dev(div5, t13);
    			append_dev(div5, div4);
    			append_dev(div4, button3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[11]),
    					listen_dev(input0, "keydown", /*addTodo*/ ctx[4], false, false, false),
    					listen_dev(input1, "change", /*checkAllTodos*/ ctx[9], false, false, false),
    					listen_dev(button0, "click", /*click_handler_1*/ ctx[18], false, false, false),
    					listen_dev(button1, "click", /*click_handler_2*/ ctx[19], false, false, false),
    					listen_dev(button2, "click", /*click_handler_3*/ ctx[20], false, false, false),
    					listen_dev(button3, "click", /*clearCompleted*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*newTodo*/ 2 && input0.value !== /*newTodo*/ ctx[1]) {
    				set_input_value(input0, /*newTodo*/ ctx[1]);
    			}

    			if (dirty[0] & /*filteredTodos, editTodo, doneEdit, doneEditKeydown*/ 232) {
    				each_value = /*filteredTodos*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div6, t2);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty[0] & /*todosRemaining*/ 4) set_data_dev(t5, /*todosRemaining*/ ctx[2]);

    			if (dirty[0] & /*currentFilter*/ 1) {
    				toggle_class(button0, "active", /*currentFilter*/ ctx[0] === "all");
    			}

    			if (dirty[0] & /*currentFilter*/ 1) {
    				toggle_class(button1, "active", /*currentFilter*/ ctx[0] === "active");
    			}

    			if (dirty[0] & /*currentFilter*/ 1) {
    				toggle_class(button2, "active", /*currentFilter*/ ctx[0] === "completed");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const ENTER_KEY = 13;
    const ESCAPE_KEY = 27;

    function instance($$self, $$props, $$invalidate) {
    	let beforeEditCache = "";
    	let currentFilter = "all";
    	let newTodo = "";
    	let tempId = 4;
    	let NOTSTARTED = "Not Started";
    	let INPROGRESS = "In Progress";
    	let COMPLETED = "Completed";
    	let STATUS_LIST = { NOTSTARTED, INPROGRESS, COMPLETED };
    	let myTodos = [];

    	async function getItems() {
    		const response = await fetch("http://localhost:5000/items/all");
    		const todo = await response.json();
    		myTodos = todo.items;
    		console.log(myTodos);
    	}

    	let todos = [];
    	let input = "";

    	async function addItem() {
    		let data = { item: input };

    		const res = await fetch("http://localhost:5000/item/new", {
    			method: "POST",
    			headers: {
    				"Content-Type": "application/json;charset=utf-8"
    			},
    			body: JSON.stringify(data)
    		});

    		const json = await res.json();
    		let result = JSON.stringify(json);
    		console.log(result);
    		getItems();
    	}

    	function addTodo() {
    		if (input) addItem();
    		input = "";

    		if (event.key === "Enter") {
    			todos.push({
    				id: tempId,
    				completed: false,
    				title: newTodo,
    				editing: false
    			});

    			$$invalidate(24, todos);
    			tempId = tempId + 1;
    			$$invalidate(1, newTodo = "");
    		}
    	}

    	function editTodo(todo) {
    		beforeEditCache = todo.title;
    		todo.editing = true;
    		$$invalidate(24, todos);
    	}

    	function doneEdit(todo) {
    		if (todo.title.trim() === "") {
    			todo.title = beforeEditCache;
    		}

    		todo.editing = false;
    		$$invalidate(24, todos);
    	}

    	function doneEditKeydown(todo, event) {
    		if (event.key === "Enter") {
    			doneEdit(todo);
    		}

    		if (event.key === "Escape") {
    			todo.title = beforeEditCache;
    			todo.editing = false;
    			$$invalidate(24, todos);
    		}
    	}

    	function clearCompleted() {
    		$$invalidate(24, todos = todos.filter(todo => !todo.completed));
    	}

    	function checkAllTodos(event) {
    		todos.forEach(todo => todo.completed = event.target.checked);
    		$$invalidate(24, todos);
    	}

    	function updateFilter(filter) {
    		$$invalidate(0, currentFilter = filter);
    	}

    	async function removeTodo(id) {
    		let data = { itemid: id };

    		const res = await fetch("http://localhost:5000/item/remove", {
    			method: "DELETE",
    			headers: {
    				"Content-Type": "application/json;charset=utf-8"
    			},
    			body: JSON.stringify(data)
    		});

    		$$invalidate(24, todos = todos.filter(todo => todo.id !== id));
    		getItems();
    	}

    	onMount(async () => {
    		getItems();
    		const res = await fetch("https://api.kanye.rest");
    		const response = await res.json();
    		console.log(response.quote);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);

    	function input0_input_handler() {
    		newTodo = this.value;
    		$$invalidate(1, newTodo);
    	}

    	function input_1_change_handler(each_value, todo_index) {
    		each_value[todo_index].completed = this.checked;
    		(($$invalidate(3, filteredTodos), $$invalidate(0, currentFilter)), $$invalidate(24, todos));
    	}

    	const dblclick_handler = todo => editTodo(todo);

    	function input_1_input_handler(each_value, todo_index) {
    		each_value[todo_index].title = this.value;
    		(($$invalidate(3, filteredTodos), $$invalidate(0, currentFilter)), $$invalidate(24, todos));
    	}

    	const blur_handler = todo => doneEdit(todo);
    	const keydown_handler = todo => doneEditKeydown(todo, event);
    	const click_handler = todo => deleteTodo(todo.id);
    	const click_handler_1 = () => updateFilter("all");
    	const click_handler_2 = () => updateFilter("active");
    	const click_handler_3 = () => updateFilter("completed");

    	$$self.$capture_state = () => ({
    		onMount,
    		fade,
    		fly,
    		ENTER_KEY,
    		ESCAPE_KEY,
    		beforeEditCache,
    		currentFilter,
    		newTodo,
    		tempId,
    		NOTSTARTED,
    		INPROGRESS,
    		COMPLETED,
    		STATUS_LIST,
    		myTodos,
    		getItems,
    		todos,
    		input,
    		addItem,
    		addTodo,
    		editTodo,
    		doneEdit,
    		doneEditKeydown,
    		clearCompleted,
    		checkAllTodos,
    		updateFilter,
    		removeTodo,
    		todosRemaining,
    		filteredTodos
    	});

    	$$self.$inject_state = $$props => {
    		if ("beforeEditCache" in $$props) beforeEditCache = $$props.beforeEditCache;
    		if ("currentFilter" in $$props) $$invalidate(0, currentFilter = $$props.currentFilter);
    		if ("newTodo" in $$props) $$invalidate(1, newTodo = $$props.newTodo);
    		if ("tempId" in $$props) tempId = $$props.tempId;
    		if ("NOTSTARTED" in $$props) NOTSTARTED = $$props.NOTSTARTED;
    		if ("INPROGRESS" in $$props) INPROGRESS = $$props.INPROGRESS;
    		if ("COMPLETED" in $$props) COMPLETED = $$props.COMPLETED;
    		if ("STATUS_LIST" in $$props) STATUS_LIST = $$props.STATUS_LIST;
    		if ("myTodos" in $$props) myTodos = $$props.myTodos;
    		if ("todos" in $$props) $$invalidate(24, todos = $$props.todos);
    		if ("input" in $$props) input = $$props.input;
    		if ("todosRemaining" in $$props) $$invalidate(2, todosRemaining = $$props.todosRemaining);
    		if ("filteredTodos" in $$props) $$invalidate(3, filteredTodos = $$props.filteredTodos);
    	};

    	let todosRemaining;
    	let filteredTodos;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*currentFilter, todos*/ 16777217) {
    			 $$invalidate(3, filteredTodos = currentFilter === "all"
    			? todos
    			: currentFilter === "completed"
    				? todos.filter(todo => todo.completed)
    				: todos.filter(todo => !todo.completed));
    		}

    		if ($$self.$$.dirty[0] & /*filteredTodos*/ 8) {
    			 $$invalidate(2, todosRemaining = filteredTodos.filter(todo => !todo.completed).length);
    		}
    	};

    	return [
    		currentFilter,
    		newTodo,
    		todosRemaining,
    		filteredTodos,
    		addTodo,
    		editTodo,
    		doneEdit,
    		doneEditKeydown,
    		clearCompleted,
    		checkAllTodos,
    		updateFilter,
    		input0_input_handler,
    		input_1_change_handler,
    		dblclick_handler,
    		input_1_input_handler,
    		blur_handler,
    		keydown_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
