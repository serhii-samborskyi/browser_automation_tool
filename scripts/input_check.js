log('input visible?', input);
return { ok: true, hasInput: !!input, keys: Object.keys(input || {}) };
