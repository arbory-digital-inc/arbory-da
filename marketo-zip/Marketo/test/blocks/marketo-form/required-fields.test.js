/**
 * marketo-form: every unfilled required field turns red, not just the first.
 *
 * Marketo's native validation stops at the FIRST invalid field, so only that one
 * ever gets `aria-invalid` — a user with three empty required fields sees one red
 * box, fills it, submits, sees the next. markEmptyRequiredFields() marks them all
 * in one pass, and wireInvalidClearing() drops a field's mark as soon as it's filled.
 *
 * Contract: all empty required fields get marked; filled and non-required fields
 * never do; checkbox/radio groups count as filled when ANY member is checked.
 */
import { expect } from '@esm-bundle/chai';
import {
  isFieldEmpty,
  markEmptyRequiredFields,
  wireInvalidClearing,
} from '../../../tools/marketo/marketo.js';

/**
 * Build Marketo-shaped form markup. Marketo emits `.mktoField` inputs wrapped in
 * `.mktoFieldWrap.mktoRequiredField` and sets aria-required on required inputs.
 */
function buildForm(fields) {
  const form = document.createElement('form');
  form.className = 'mktoForm';
  form.innerHTML = fields
    .map((f) => `
      <div class="mktoFormRow">
        <div class="mktoFieldWrap${f.required === false ? '' : ' mktoRequiredField'}">
          <label for="${f.name}">${f.name}</label>
          <input id="${f.name}" name="${f.name}" type="${f.type || 'text'}" class="mktoField"
            value="${f.value || ''}" ${f.checked ? 'checked' : ''}
            ${f.required === false ? '' : 'aria-required="true"'}>
        </div>
      </div>`)
    .join('');
  document.body.append(form);
  return form;
}

const marked = (form) => [...form.querySelectorAll('.mkto-field-invalid')].map((f) => f.name);

describe('marketo-form required-field marking', () => {
  let form;
  afterEach(() => form?.remove());

  it('marks EVERY empty required field, not just the first', () => {
    form = buildForm([
      { name: 'FirstName' },
      { name: 'LastName' },
      { name: 'Email', type: 'email' },
    ]);

    markEmptyRequiredFields(form);

    expect(marked(form)).to.deep.equal(['FirstName', 'LastName', 'Email']);
    form.querySelectorAll('.mktoField').forEach((f) => {
      expect(f.getAttribute('aria-invalid')).to.equal('true');
    });
  });

  it('leaves filled and non-required fields alone', () => {
    form = buildForm([
      { name: 'FirstName', value: 'Ada' },
      { name: 'LastName' },
      { name: 'Company', required: false },
    ]);

    markEmptyRequiredFields(form);

    expect(marked(form)).to.deep.equal(['LastName']);
  });

  it('treats whitespace-only input as empty', () => {
    form = buildForm([{ name: 'FirstName', value: '   ' }]);

    markEmptyRequiredFields(form);

    expect(marked(form)).to.deep.equal(['FirstName']);
  });

  it('counts a checkbox/radio group as filled when any member is checked', () => {
    form = buildForm([
      { name: 'Consent', type: 'checkbox' },
      { name: 'Contact', type: 'radio', checked: true },
    ]);

    markEmptyRequiredFields(form);

    expect(marked(form)).to.deep.equal(['Consent']);
    expect(isFieldEmpty(form.querySelector('[name="Contact"]'), form)).to.equal(false);
  });

  it('re-marking clears fields that have since been filled', () => {
    form = buildForm([{ name: 'FirstName' }, { name: 'LastName' }]);
    markEmptyRequiredFields(form);

    form.querySelector('[name="FirstName"]').value = 'Ada';
    markEmptyRequiredFields(form);

    expect(marked(form)).to.deep.equal(['LastName']);
  });

  it('clears a field\'s mark as soon as the user types into it', () => {
    form = buildForm([{ name: 'FirstName' }, { name: 'LastName' }]);
    wireInvalidClearing(form);
    markEmptyRequiredFields(form);

    const first = form.querySelector('[name="FirstName"]');
    first.value = 'Ada';
    first.dispatchEvent(new Event('input', { bubbles: true }));

    expect(marked(form)).to.deep.equal(['LastName']);
    expect(first.hasAttribute('aria-invalid')).to.equal(false);
  });
});
