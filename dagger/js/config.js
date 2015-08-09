/*
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

// ====== Configuration Functions ======
function setModeName(mode_name) {
    if (mode_name === 'offline' || mode_name === 'unguarded') {
        checker.cloakerCatcherMode = mode_name;
    } else {
        checker.cloakerCatcherMode = "online";
    }
}

function getModeName(callback) {
    var currentMode = checker.cloakerCatcherMode;
    if (typeof currentMode === 'undefined' || (
        currentMode !== 'offline' &&
        currentMode !== 'online' &&
        currentMode !== 'unguarded')) {
        currentMode = 'online';
        setModeName(currentMode);
        callback(currentMode);
    } else {
        callback(currentMode);
    }
}

// called in popup.js
function changeMode(new_mode_name) {
    setModeName(new_mode_name);
    console.log('change mode to ' + checker.cloakerCatcherMode);
}