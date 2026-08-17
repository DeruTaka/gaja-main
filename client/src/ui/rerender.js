/* Forward-reference seam: gaja.html declared `let rerender = () => {}` and assigned
   the real implementation later in the same script (onboarding), while several
   earlier-loaded sections (form field listeners) already called it. ES modules can't
   reassign an imported binding from outside its own module, so that forward
   reference becomes a mutable holder object instead — main.js wires `hook.fn` to the
   real implementation once, during boot. */
export const rerenderHook = { fn: () => {} };
export const rerender = () => rerenderHook.fn();
